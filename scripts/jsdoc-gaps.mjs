#!/usr/bin/env node
/**
 * List public API members that have no JSDoc, per component.
 *
 * Companion to `review-audit.mjs`, which only counts them. This one names them
 * so the gap can actually be worked through.
 *
 *   node scripts/jsdoc-gaps.mjs                  # summary, worst first
 *   node scripts/jsdoc-gaps.mjs <component>      # every missing member, with file:line
 *   node scripts/jsdoc-gaps.mjs --inputs-only    # skip public methods
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const UI_DIR = join(ROOT, 'packages', 'components', 'ui');

const args = process.argv.slice(2);
const INPUTS_ONLY = args.includes('--inputs-only');
const only = args.find(a => !a.startsWith('--')) ?? null;

const isSource = f => f.endsWith('.ts') && !/\.(spec|stories)\.ts$/.test(f);

function walk(dir, out = []) {
    for (const e of readdirSync(dir)) {
        if (e === 'node_modules' || e === '__screenshots__') continue;
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

const hasJsDoc = n => (ts.getJSDocCommentsAndTags(n) ?? []).length > 0;

function apiKind(member) {
    const init = member.initializer;
    if (!init || !ts.isCallExpression(init)) return null;
    let expr = init.expression;
    while (ts.isPropertyAccessExpression(expr)) expr = expr.expression;
    const name = expr.getText();
    return ['input', 'output', 'model'].includes(name) ? name : null;
}

const rows = [];

for (const comp of readdirSync(UI_DIR).filter(e => statSync(join(UI_DIR, e)).isDirectory())) {
    if (only && comp !== only) continue;
    const missing = [];

    for (const file of walk(join(UI_DIR, comp)).filter(isSource)) {
        const src = readFileSync(file, 'utf8');
        const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
        const rel = relative(UI_DIR, file).split(sep).join('/');

        const lineOf = m => sf.getLineAndCharacterOfPosition(m.getStart(sf)).line + 1;

        const checkProperty = m => {
            const kind = apiKind(m);
            if (!kind || hasJsDoc(m)) return;
            missing.push({ rel, line: lineOf(m), kind, name: m.name.getText() });
        };

        const checkMethod = m => {
            if (INPUTS_ONLY || hasJsDoc(m)) return;
            const hidden = m.modifiers?.some(x =>
                x.kind === ts.SyntaxKind.PrivateKeyword || x.kind === ts.SyntaxKind.ProtectedKeyword);
            const name = m.name.getText();
            if (hidden || name.startsWith('ng')) return;
            missing.push({ rel, line: lineOf(m), kind: 'method', name });
        };

        const visit = node => {
            if (ts.isClassDeclaration(node)) {
                for (const m of node.members) {
                    if (ts.isPropertyDeclaration(m)) checkProperty(m);
                    else if (ts.isMethodDeclaration(m)) checkMethod(m);
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
    }

    if (missing.length) rows.push({ comp, missing });
}

rows.sort((a, b) => b.missing.length - a.missing.length);

if (only) {
    for (const r of rows) {
        console.log('\n' + r.comp + '  (' + r.missing.length + ' undocumented)');
        let lastFile = '';
        for (const m of r.missing.sort((x, y) => x.rel.localeCompare(y.rel) || x.line - y.line)) {
            if (m.rel !== lastFile) { console.log('\n  ' + m.rel); lastFile = m.rel; }
            console.log('    ' + String(m.line).padStart(5) + '  ' + m.kind.padEnd(7) + '  ' + m.name);
        }
    }
} else {
    let total = 0;
    for (const r of rows) {
        const io = r.missing.filter(m => m.kind !== 'method').length;
        const me = r.missing.length - io;
        console.log(String(r.missing.length).padStart(5) + '  ' + r.comp.padEnd(28)
            + 'io:' + String(io).padEnd(6) + 'methods:' + me);
        total += r.missing.length;
    }
    console.log('\n' + total + ' undocumented public members across ' + rows.length + ' components');
}
