#!/usr/bin/env node
/**
 * Read-only code-review audit over `packages/components/ui/**`.
 *
 * Reports the mechanical half of the four review criteria (cleanliness,
 * ease of use/modify, readability, over-abstraction) so the judgment half
 * can focus on the folders the numbers flag.
 *
 * Deliberately does NOT re-implement `readonly` (S2933), cognitive
 * complexity (S3776) or unused declarations — `npm run sonar` and eslint
 * already cover those. Run this alongside them, not instead.
 *
 *   node scripts/review-audit.mjs              # summary + flagged folders
 *   node scripts/review-audit.mjs --all        # every folder
 *   node scripts/review-audit.mjs --json       # machine-readable
 *   node scripts/review-audit.mjs --md         # markdown tables
 *   node scripts/review-audit.mjs --component rich-text-editor
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const UI_DIR = join(ROOT, 'packages', 'components', 'ui');

const argv = process.argv.slice(2);
const OPT = {
    all: argv.includes('--all'),
    json: argv.includes('--json'),
    md: argv.includes('--md'),
    component: argv[argv.indexOf('--component') + 1] ?? null,
};
if (!argv.includes('--component')) OPT.component = null;

/** Double-encoded UTF-8 signatures. A bare `ג` over-matches real Hebrew in locale files. */
const MOJIBAKE = /ג€|ג”|Ã¢|â€|Â»|Ã©/g;

const isSpecOrStory = f => /\.(spec|stories)\.ts$/.test(f);
const isSource = f => f.endsWith('.ts') && !isSpecOrStory(f);

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '__screenshots__') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

/**
 * Count non-JSDoc comments via the parser's comment ranges.
 *
 * A raw `ts.createScanner` cannot disambiguate `/` as regex-start vs divide
 * and silently swallows comments inside regex-heavy files; a plain `//` grep
 * over-counts, matching `https://` and `//` inside string literals. Walking
 * every node's leading/trailing comment ranges off a real parse avoids both.
 *
 * `//` lines are skipped when they are tooling pragmas; `/* *\/` blocks are
 * skipped when they open with `/**` (JSDoc).
 */
function countComments(src, sf) {
    const seen = new Set();
    let line = 0;
    let block = 0;

    const take = range => {
        if (!range || seen.has(range.pos)) return;
        seen.add(range.pos);
        const text = src.slice(range.pos, range.end);
        if (range.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
            if (!/^\/\/\s*(eslint|@ts-|prettier|istanbul|c8|biome|#|\/)/.test(text)) line++;
        } else if (!text.startsWith('/**')) {
            block++;
        }
    };

    const visit = node => {
        if (node.pos !== node.end) {
            (ts.getLeadingCommentRanges(src, node.pos) ?? []).forEach(take);
            (ts.getTrailingCommentRanges(src, node.end) ?? []).forEach(take);
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return { line, block };
}

const hasJsDoc = node => (ts.getJSDocCommentsAndTags(node) ?? []).length > 0;
const isExported = node =>
    !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

/** Signal-API members: `x = input(...)`, `output(...)`, `model(...)`. */
function signalApiKind(member) {
    const init = member.initializer;
    if (!init) return null;
    let call = init;
    while (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression)) {
        call = call.expression.expression;
    }
    const expr = ts.isCallExpression(init) ? init.expression : null;
    if (!expr) return null;
    const name = ts.isPropertyAccessExpression(expr) ? expr.expression.getText() : expr.getText();
    return ['input', 'output', 'model'].includes(name) ? name : null;
}

function analyzeFile(absPath, src) {
    const sf = ts.createSourceFile(absPath, src, ts.ScriptTarget.Latest, true);
    const res = {
        types: [], typesUnexported: [],
        apiTotal: 0, apiUndocumented: [],
        methodTotal: 0, methodUndocumented: [],
        anyCount: (src.match(/:\s*any\b|<any>|\bas any\b|\bany\[\]/g) ?? []).length,
        deepImports: [],
        longestFn: { name: '', lines: 0 },
    };

    const visitTypeDecl = node => {
        const name = node.name.getText();
        res.types.push(name);
        if (!isExported(node)) res.typesUnexported.push(name);
    };

    const visitImport = node => {
        const spec = node.moduleSpecifier.getText().slice(1, -1);
        // A relative import reaching INTO another component folder's internals.
        if (/^\.\.\/[^.\/][^\/]*\/.+/.test(spec) && !spec.includes('/lib/')) {
            res.deepImports.push(spec);
        }
    };

    const visitMethod = member => {
        const name = member.name.getText();
        if (member.body) {
            const lines = sf.getLineAndCharacterOfPosition(member.body.end).line
                - sf.getLineAndCharacterOfPosition(member.body.pos).line;
            if (lines > res.longestFn.lines) res.longestFn = { name, lines };
        }
        const isPrivate = member.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword);
        if (isPrivate || name.startsWith('ng')) return;
        res.methodTotal++;
        if (!hasJsDoc(member)) res.methodUndocumented.push(name);
    };

    const visitClass = node => {
        for (const member of node.members) {
            if (ts.isPropertyDeclaration(member) && signalApiKind(member)) {
                res.apiTotal++;
                if (!hasJsDoc(member)) res.apiUndocumented.push(member.name.getText());
            } else if (ts.isMethodDeclaration(member)) {
                visitMethod(member);
            }
        }
    };

    const isTypeDecl = node =>
        ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node);

    const visit = node => {
        if (isTypeDecl(node)) visitTypeDecl(node);
        else if (ts.isImportDeclaration(node)) visitImport(node);
        else if (ts.isClassDeclaration(node)) visitClass(node);
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return res;
}

/** Symbols reachable through a folder's `index.ts`, following `export *`. */
function barrelExports(folder) {
    const seen = new Set();
    const read = rel => {
        const abs = join(folder, rel);
        let src;
        try { src = readFileSync(abs, 'utf8'); } catch { return; }
        const sf = ts.createSourceFile(abs, src, ts.ScriptTarget.Latest, true);
        for (const st of sf.statements) {
            if (!ts.isExportDeclaration(st) || !st.moduleSpecifier) continue;
            const spec = st.moduleSpecifier.getText().slice(1, -1);
            if (st.exportClause && ts.isNamedExports(st.exportClause)) {
                for (const e of st.exportClause.elements) seen.add(e.name.getText());
            } else {
                seen.add(`*:${spec}`);
            }
        }
    };
    read('index.ts');
    return seen;
}

const components = readdirSync(UI_DIR)
    .filter(e => statSync(join(UI_DIR, e)).isDirectory())
    .filter(e => !OPT.component || e === OPT.component)
    .sort();

const rows = [];

for (const name of components) {
    const folder = join(UI_DIR, name);
    const files = walk(folder);
    const sources = files.filter(f => isSource(f));
    if (!sources.length) continue;

    const barrel = barrelExports(folder);
    const barrelStars = [...barrel].filter(s => s.startsWith('*:')).map(s => s.slice(2));

    const row = {
        component: name,
        files: sources.length,
        specFiles: files.filter(f => isSpecOrStory(f)).length,
        loc: 0, specLoc: 0,
        largestFile: { file: '', lines: 0 },
        longestFn: { file: '', name: '', lines: 0 },
        mojibake: [], comments: 0, blockComments: 0, commentFiles: [], any: 0,
        typesTotal: 0, typesUnexported: [],
        apiTotal: 0, apiUndocumented: 0,
        methodTotal: 0, methodUndocumented: 0,
        deepImports: [], hasBarrel: barrel.size > 0,
        unreachableFiles: [],
    };

    for (const f of files) {
        const src = readFileSync(f, 'utf8');
        const lines = src.split('\n').length;
        const rel = relative(UI_DIR, f).split(sep).join('/');

        if (isSpecOrStory(f)) { row.specLoc += lines; }

        const moji = src.match(MOJIBAKE);
        if (moji) row.mojibake.push({ file: rel, count: moji.length });
        if (!isSource(f)) continue;

        row.loc += lines;
        if (lines > row.largestFile.lines) row.largestFile = { file: rel, lines };

        const a = analyzeFile(f, src);
        const c = countComments(src, ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true));
        row.comments += c.line;
        row.blockComments += c.block;
        const blockNote = c.block ? ` +${c.block} block` : '';
        if (c.line + c.block) row.commentFiles.push(`${rel}  ${c.line}//${blockNote}`);
        row.any += a.anyCount;
        row.typesTotal += a.types.length;
        row.typesUnexported.push(...a.typesUnexported.map(t => `${rel}:${t}`));
        row.apiTotal += a.apiTotal;
        row.apiUndocumented += a.apiUndocumented.length;
        row.methodTotal += a.methodTotal;
        row.methodUndocumented += a.methodUndocumented.length;
        row.deepImports.push(...a.deepImports.map(d => `${rel} → ${d}`));
        if (a.longestFn.lines > row.longestFn.lines) {
            row.longestFn = { file: rel, ...a.longestFn };
        }

        // Top-level source not reachable from the barrel (sub/ + addons/ are opt-in by design).
        const relToFolder = relative(folder, f).split(sep).join('/');
        if (!relToFolder.includes('/') && relToFolder !== 'index.ts') {
            const modPath = './' + relToFolder.replace(/\.ts$/, '');
            if (barrel.size && !barrelStars.includes(modPath)) row.unreachableFiles.push(relToFolder);
        }
    }
    rows.push(row);
}

const flagged = r =>
    r.mojibake.length || r.any || r.comments > 5 || r.typesUnexported.length ||
    r.deepImports.length || !r.hasBarrel || r.unreachableFiles.length ||
    r.loc > 2000 || r.longestFn.lines > 45 ||
    (r.apiTotal && r.apiUndocumented / r.apiTotal > 0.3);

function tier(r) {
    if (r.loc > 2000) return 'A';
    if (r.loc >= 500) return 'B';
    return 'C';
}
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 100);

if (OPT.json) {
    console.log(JSON.stringify({ generated: 'review-audit', rows }, null, 2));
    process.exit(0);
}

const shown = (OPT.all || OPT.component ? rows : rows.filter(flagged))
    .sort((a, b) => b.loc - a.loc);

const totals = rows.reduce((t, r) => ({
    loc: t.loc + r.loc, specLoc: t.specLoc + r.specLoc, files: t.files + r.files,
    comments: t.comments + r.comments + r.blockComments, any: t.any + r.any,
    mojibake: t.mojibake + r.mojibake.reduce((s, m) => s + m.count, 0),
    typesUnexported: t.typesUnexported + r.typesUnexported.length,
    deepImports: t.deepImports + r.deepImports.length,
    apiTotal: t.apiTotal + r.apiTotal, apiUndoc: t.apiUndoc + r.apiUndocumented,
    methodTotal: t.methodTotal + r.methodTotal, methodUndoc: t.methodUndoc + r.methodUndocumented,
    noBarrel: t.noBarrel + (r.hasBarrel ? 0 : 1),
    unreachable: t.unreachable + r.unreachableFiles.length,
}), {
    loc: 0, specLoc: 0, files: 0, comments: 0, any: 0, mojibake: 0, typesUnexported: 0,
    deepImports: 0, apiTotal: 0, apiUndoc: 0, methodTotal: 0, methodUndoc: 0,
    noBarrel: 0, unreachable: 0,
});

const bar = OPT.md ? '' : '='.repeat(100);
const h = s => (OPT.md ? `\n## ${s}\n` : `\n${s}\n${bar}`);

console.log(h('Library audit — summary'));
const summary = [
    ['Components', rows.length],
    ['Source files / LOC', `${totals.files} / ${totals.loc.toLocaleString()}`],
    ['Spec+story LOC', totals.specLoc.toLocaleString()],
    ['Tier A (>2k LOC) / B (500–2k) / C (<500)',
        `${rows.filter(r => tier(r) === 'A').length} / ${rows.filter(r => tier(r) === 'B').length} / ${rows.filter(r => tier(r) === 'C').length}`],
    ['Non-JSDoc comments', totals.comments],
    ['Mojibake chars', totals.mojibake],
    ['`any` occurrences', totals.any],
    ['Unexported types', totals.typesUnexported],
    ['Cross-component deep imports', totals.deepImports],
    ['Folders without a barrel', totals.noBarrel],
    ['Top-level files not in a barrel', totals.unreachable],
    ['input/output JSDoc coverage', `${pct(totals.apiTotal - totals.apiUndoc, totals.apiTotal)}% (${totals.apiUndoc} missing of ${totals.apiTotal})`],
    ['Public-method JSDoc coverage', `${pct(totals.methodTotal - totals.methodUndoc, totals.methodTotal)}% (${totals.methodUndoc} missing of ${totals.methodTotal})`],
];
if (OPT.md) {
    console.log('| Metric | Value |\n|---|---|');
    for (const [k, v] of summary) console.log(`| ${k} | ${v} |`);
} else {
    for (const [k, v] of summary) console.log(`  ${k.padEnd(42)} ${v}`);
}

console.log(h(OPT.all || OPT.component ? 'All components' : `Flagged components (${shown.length} of ${rows.length})`));
const cols = ['component', 'T', 'LOC', 'files', 'cmts', 'moji', 'any', 'unexpT', 'deepImp', 'io%', 'fn%', 'maxFn'];
if (OPT.md) {
    console.log(`| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|`);
} else {
    console.log('  ' + cols.map((c, i) => c.padEnd(i === 0 ? 26 : 8)).join(''));
}
for (const r of shown) {
    const cells = [
        r.component, tier(r), r.loc, r.files, r.comments + r.blockComments,
        r.mojibake.reduce((s, m) => s + m.count, 0), r.any, r.typesUnexported.length,
        r.deepImports.length, pct(r.apiTotal - r.apiUndocumented, r.apiTotal),
        pct(r.methodTotal - r.methodUndocumented, r.methodTotal), r.longestFn.lines,
    ];
    console.log(OPT.md
        ? `| ${cells.join(' | ')} |`
        : '  ' + cells.map((c, i) => String(c).padEnd(i === 0 ? 26 : 8)).join(''));
}

console.log(h('Detail — items needing a decision'));
const detail = (label, items) => {
    if (!items.length) return;
    console.log(`\n${label} (${items.length}):`);
    for (const i of items.slice(0, 40)) console.log(`  ${i}`);
    if (items.length > 40) console.log(`  … and ${items.length - 40} more`);
};
detail('Mojibake', rows.flatMap(r => r.mojibake.map(m => `${m.file}  ×${m.count}`)));
detail('Files with non-JSDoc comments', rows
    .flatMap(r => r.commentFiles)
    .sort((a, b) => Number.parseInt(b.split(/\s{2,}/)[1], 10) - Number.parseInt(a.split(/\s{2,}/)[1], 10)));
detail('Cross-component deep imports', rows.flatMap(r => r.deepImports));
detail('Folders without a barrel', rows.filter(r => !r.hasBarrel).map(r => r.component));
detail('Top-level files not reachable from their barrel',
    rows.flatMap(r => r.unreachableFiles.map(f => `${r.component}/${f}`)));
detail('Longest functions (>45 lines)', rows
    .filter(r => r.longestFn.lines > 45)
    .sort((a, b) => b.longestFn.lines - a.longestFn.lines)
    .map(r => `${String(r.longestFn.lines).padStart(4)}  ${r.longestFn.file}  ${r.longestFn.name}()`));
detail('Largest source files (>800 lines)', rows
    .filter(r => r.largestFile.lines > 800)
    .sort((a, b) => b.largestFile.lines - a.largestFile.lines)
    .map(r => `${String(r.largestFile.lines).padStart(5)}  ${r.largestFile.file}`));

console.log(`\n${OPT.md ? '' : bar}`);
console.log('Not covered here — use the existing gates:');
console.log('  readonly (S2933), cognitive complexity (S3776), unused decls → npm run sonar');
console.log('  lint rules → npm run lint');
