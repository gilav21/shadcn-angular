import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { registry, type BreakingChange, type ComponentName } from '../registry/index.js';
import { collectComponentFiles, toTarget, readTemplate, type Target } from './apply-core.js';

/**
 * Rewrites a consumer's own templates for the input/output changes a
 * component's breaking metadata declares as mechanical: a renamed binding, a
 * set of inputs folded into one object input, an input dropped outright, and
 * a renamed exported identifier. `update --fix` runs it; `update` alone only
 * reports what it would change.
 *
 * The rewrite works on start tags, attribute by attribute, so a value keeps
 * its exact expression and the rest of the tag keeps its whitespace. Anything
 * the rules cannot decide — an element that already binds the merged input —
 * is reported for a hand edit rather than guessed at.
 */

/** One rewrite made (or, without `write`, one that would be made). */
export interface BindingEdit {
    readonly file: string;
    readonly line: number;
    readonly from: string;
    readonly to: string;
}

export interface BindingCodemodReport {
    readonly edits: BindingEdit[];
    /** Places a rule matched but refused to touch, with the reason. */
    readonly manual: BindingEdit[];
    readonly filesWritten: number;
}

type Rule =
    | { readonly kind: 'rename'; readonly map: Readonly<Record<string, string>> }
    | { readonly kind: 'merge'; readonly into: string; readonly keys: Readonly<Record<string, string>> }
    | { readonly kind: 'drop'; readonly names: readonly string[] }
    | { readonly kind: 'counter' }
    | { readonly kind: 'identifier'; readonly map: Readonly<Record<string, string>> };

/** The rule a breaking change carries, or null when it is note-only. */
export function ruleOf(change: BreakingChange): Rule | null {
    switch (change.codemod) {
        case 'input-rename':
        case 'output-rename':
            return change.rename ? { kind: 'rename', map: change.rename } : null;
        case 'input-merge':
            return change.merge ? { kind: 'merge', into: change.merge.into, keys: change.merge.keys } : null;
        case 'input-drop':
            return change.drop ? { kind: 'drop', names: change.drop } : null;
        case 'rte-counter':
            return { kind: 'counter' };
        case 'identifier-rename':
            return change.rename ? { kind: 'identifier', map: change.rename } : null;
        default:
            return null;
    }
}

/** The binding names a rule touches, for the usage scan. */
export function ruleTokens(change: BreakingChange): string[] {
    const rule = ruleOf(change);
    if (!rule) return [];
    switch (rule.kind) {
        case 'rename': return Object.keys(rule.map);
        case 'merge': return Object.keys(rule.keys);
        case 'drop': return [...rule.names];
        case 'counter': return ['showCount', 'showWordCount'];
        case 'identifier': return [];
    }
}

export function rulesFor(components: Iterable<ComponentName>): Rule[] {
    const rules: Rule[] = [];
    for (const name of components) {
        for (const change of registry[name].breaking ?? []) {
            const rule = ruleOf(change);
            if (rule) rules.push(rule);
        }
    }
    return rules;
}

// ── Start-tag parsing ────────────────────────────────────────────────────────

type AttrForm = 'prop' | 'event' | 'banana' | 'static' | 'bare';

interface Attr {
    /** Whitespace that preceded the attribute in the source. */
    readonly gap: string;
    /** Offset of the attribute name in the source, for line numbers. */
    readonly at: number;
    readonly name: string;
    readonly form: AttrForm;
    /** The value between its quotes; null for a bare attribute. */
    readonly value: string | null;
    readonly quote: string;
}

interface Tag {
    readonly start: number;
    readonly end: number;
    readonly open: string;
    readonly attrs: Attr[];
    readonly close: string;
}

const NAME_END = new Set([' ', '\t', '\n', '\r', '=', '>', '/']);

function parseAttrName(raw: string): { name: string; form: AttrForm } {
    if (raw.startsWith('[(') && raw.endsWith(')]')) return { name: raw.slice(2, -2), form: 'banana' };
    if (raw.startsWith('[') && raw.endsWith(']')) return { name: raw.slice(1, -1), form: 'prop' };
    if (raw.startsWith('(') && raw.endsWith(')')) return { name: raw.slice(1, -1), form: 'event' };
    return { name: raw, form: 'static' };
}

function readAttrValue(src: string, at: number): { value: string; quote: string; next: number } | null {
    const quote = src[at];
    if (quote === '"' || quote === "'") {
        const close = src.indexOf(quote, at + 1);
        if (close < 0) return null;
        return { value: src.slice(at + 1, close), quote, next: close + 1 };
    }
    let i = at;
    while (i < src.length && !/[\s>]/.test(src[i])) i++;
    return { value: src.slice(at, i), quote: '', next: i };
}

function skipInline(src: string, i: number): number {
    while (i < src.length && /[ \t]/.test(src[i])) i++;
    return i;
}

/** One attribute whose name starts at `src[i]`, or null when malformed. */
function parseAttrAt(src: string, gap: string, i: number): { attr: Attr; next: number } | null {
    let j = i;
    while (j < src.length && !NAME_END.has(src[j])) j++;
    if (j === i) return null;
    const { name, form } = parseAttrName(src.slice(i, j));
    const k = skipInline(src, j);
    if (src[k] !== '=') {
        return { attr: { gap, at: i, name, form: form === 'static' ? 'bare' : form, value: null, quote: '' }, next: j };
    }
    const read = readAttrValue(src, skipInline(src, k + 1));
    if (!read) return null;
    return { attr: { gap, at: i, name, form, value: read.value, quote: read.quote }, next: read.next };
}

/** Parses the start tag beginning at `<` in `src[at]`; null when it is not one. */
function parseTag(src: string, at: number): Tag | null {
    const open = /^<[a-zA-Z][\w:.-]*/.exec(src.slice(at, at + 128));
    if (!open) return null;
    let i = at + open[0].length;
    const attrs: Attr[] = [];
    while (i < src.length) {
        const gapStart = i;
        while (i < src.length && /\s/.test(src[i])) i++;
        const gap = src.slice(gapStart, i);
        if (src.startsWith('/>', i)) return { start: at, end: i + 2, open: open[0], attrs, close: `${gap}/>` };
        if (src[i] === '>') return { start: at, end: i + 1, open: open[0], attrs, close: `${gap}>` };
        if (src[i] === '<') return null;
        const parsed = parseAttrAt(src, gap, i);
        if (!parsed) return null;
        attrs.push(parsed.attr);
        i = parsed.next;
    }
    return null;
}

const WRAP: Record<AttrForm, (name: string) => string> = {
    prop: (n) => `[${n}]`,
    event: (n) => `(${n})`,
    banana: (n) => `[(${n})]`,
    static: (n) => n,
    bare: (n) => n,
};

function renderAttr(a: Attr): string {
    const wrapped = WRAP[a.form](a.name);
    if (a.value === null) return `${a.gap}${wrapped}`;
    const q = a.quote || '"';
    return `${a.gap}${wrapped}=${q}${a.value}${q}`;
}

function renderTag(tag: Tag): string {
    return `${tag.open}${tag.attrs.map(renderAttr).join('')}${tag.close}`;
}

// ── Rules on one tag ─────────────────────────────────────────────────────────

const LITERAL = /^(?:-?\d+(?:\.\d+)?|true|false|null|undefined)$/;

/** The template expression an attribute's value stands for. */
function expressionOf(a: Attr): string {
    if (a.value === null) return 'true';
    if (a.form !== 'static') return a.value;
    if (LITERAL.test(a.value.trim())) return a.value.trim();
    const escaped = a.value.replaceAll("'", String.raw`\'`);
    return `'${escaped}'`;
}

interface TagOutcome {
    readonly attrs: Attr[];
    readonly edits: { at: number; from: string; to: string }[];
    readonly manual: { at: number; from: string; to: string }[];
}

function label(a: Attr): string {
    return renderAttr({ ...a, gap: '' });
}

function applyRename(attrs: Attr[], map: Readonly<Record<string, string>>): TagOutcome {
    const edits: TagOutcome['edits'] = [];
    const out = attrs.map((a) => {
        const to = map[a.name];
        if (!to) return a;
        const renamed = { ...a, name: to };
        edits.push({ at: a.at, from: label(a), to: label(renamed) });
        return renamed;
    });
    return { attrs: out, edits, manual: [] };
}

function applyDrop(attrs: Attr[], names: readonly string[]): TagOutcome {
    const edits: TagOutcome['edits'] = [];
    const out = attrs.filter((a) => {
        if (!names.includes(a.name)) return true;
        edits.push({ at: a.at, from: label(a), to: '(removed)' });
        return false;
    });
    return { attrs: out, edits, manual: [] };
}

function applyMerge(attrs: Attr[], into: string, keys: Readonly<Record<string, string>>): TagOutcome {
    const matched = attrs.filter((a) => a.name in keys);
    if (matched.length === 0) return { attrs, edits: [], manual: [] };
    const existing = attrs.find((a) => a.name === into);
    if (existing) {
        return {
            attrs,
            edits: [],
            manual: matched.map((a) => ({ at: a.at, from: label(a), to: `already binds ${label(existing)}; merge by hand` })),
        };
    }
    const fields = matched.map((a) => `${keys[a.name]}: ${expressionOf(a)}`);
    const merged: Attr = {
        gap: matched[0].gap, at: matched[0].at, name: into, form: 'prop', value: `{ ${fields.join(', ')} }`, quote: '"',
    };
    const out: Attr[] = [];
    for (const a of attrs) {
        if (a === matched[0]) out.push(merged);
        else if (!matched.includes(a)) out.push(a);
    }
    return { attrs: out, edits: matched.map((a) => ({ at: a.at, from: label(a), to: label(merged) })), manual: [] };
}

/** `counter` from the two booleans: literal pairs become the value, expressions a ternary. */
function literalBoolean(s: string): boolean | null {
    if (s === 'true') return true;
    if (s === 'false') return false;
    return null;
}

function counterAttr(chars: Attr | undefined, words: Attr | undefined, first: Attr): Attr | null {
    const c = chars ? expressionOf(chars) : 'false';
    const w = words ? expressionOf(words) : 'false';
    const lc = literalBoolean(c);
    const lw = literalBoolean(w);
    const base = { gap: first.gap, at: first.at, name: 'counter', quote: '"' } as const;
    if (lc !== null && lw !== null) {
        if (lc && lw) return { ...base, form: 'static', value: 'both' };
        if (lc) return { ...base, form: 'static', value: 'characters' };
        if (lw) return { ...base, form: 'static', value: 'words' };
        return null;
    }
    const expr = `(${c}) && (${w}) ? 'both' : (${c}) ? 'characters' : (${w}) ? 'words' : undefined`;
    return { ...base, form: 'prop', value: expr };
}

function applyCounter(attrs: Attr[]): TagOutcome {
    const chars = attrs.find((a) => a.name === 'showCount');
    const words = attrs.find((a) => a.name === 'showWordCount');
    if (!chars && !words) return { attrs, edits: [], manual: [] };
    const first = (chars ?? words) as Attr;
    const replacement = counterAttr(chars, words, first);
    const out: Attr[] = [];
    for (const a of attrs) {
        if (a === first && replacement) out.push(replacement);
        else if (a !== chars && a !== words) out.push(a);
    }
    const to = replacement ? label(replacement) : '(removed)';
    const edits = [chars, words].filter((a): a is Attr => Boolean(a)).map((a) => ({ at: a.at, from: label(a), to }));
    return { attrs: out, edits, manual: [] };
}

function applyRule(attrs: Attr[], rule: Rule): TagOutcome {
    switch (rule.kind) {
        case 'rename': return applyRename(attrs, rule.map);
        case 'drop': return applyDrop(attrs, rule.names);
        case 'merge': return applyMerge(attrs, rule.into, rule.keys);
        case 'counter': return applyCounter(attrs);
        case 'identifier': return { attrs, edits: [], manual: [] };
    }
}

// ── Whole-template rewrite ───────────────────────────────────────────────────

export interface TemplateRewrite {
    readonly content: string;
    readonly edits: { line: number; from: string; to: string }[];
    readonly manual: { line: number; from: string; to: string }[];
}

function lineAt(src: string, offset: number): number {
    let line = 1;
    for (let i = 0; i < offset; i++) if (src[i] === '\n') line++;
    return line;
}

/** Applies the tag rules to every start tag in `template`. Pure. */
export function rewriteTemplate(template: string, rules: readonly Rule[]): TemplateRewrite {
    const edits: TemplateRewrite['edits'] = [];
    const manual: TemplateRewrite['manual'] = [];
    let out = '';
    let cursor = 0;
    let i = template.indexOf('<');
    while (i >= 0) {
        const tag = parseTag(template, i);
        if (!tag) {
            i = template.indexOf('<', i + 1);
            continue;
        }
        let attrs = tag.attrs;
        for (const rule of rules) {
            const result = applyRule(attrs, rule);
            attrs = result.attrs;
            for (const e of result.edits) edits.push({ line: lineAt(template, e.at), from: e.from, to: e.to });
            for (const m of result.manual) manual.push({ line: lineAt(template, m.at), from: m.from, to: m.to });
        }
        const rendered = attrs === tag.attrs ? template.slice(tag.start, tag.end) : renderTag({ ...tag, attrs });
        out += template.slice(cursor, tag.start) + rendered;
        cursor = tag.end;
        i = template.indexOf('<', tag.end);
    }
    return { content: out + template.slice(cursor), edits, manual };
}

/** Renames exported identifiers in TypeScript source, at word boundaries. Pure. */
export function rewriteIdentifiers(source: string, rules: readonly Rule[]): TemplateRewrite {
    const edits: TemplateRewrite['edits'] = [];
    let content = source;
    for (const rule of rules) {
        if (rule.kind !== 'identifier') continue;
        for (const [from, to] of Object.entries(rule.map)) {
            const re = new RegExp(String.raw`\b${from}\b`, 'g');
            for (const m of content.matchAll(re)) edits.push({ line: lineAt(content, m.index), from, to });
            content = content.replaceAll(re, to);
        }
    }
    return { content, edits, manual: [] };
}

// ── Files ────────────────────────────────────────────────────────────────────

/**
 * Applies every rule the touched components declare to the consumer's own
 * components (never the managed UI directory). With `write`, changed files are
 * saved; without it, the report says what would change.
 */
export async function rewriteBreakingBindings(
    components: Iterable<ComponentName>, root: string, managed: string[], options: { write: boolean },
): Promise<BindingCodemodReport> {
    const rules = rulesFor(components);
    const edits: BindingEdit[] = [];
    const manual: BindingEdit[] = [];
    let filesWritten = 0;
    if (rules.length === 0) return { edits, manual, filesWritten };

    for (const file of await collectComponentFiles(root, managed)) {
        const target = await toTarget(file);
        if (!target) continue;
        const result = await rewriteTarget(target, rules, options.write);
        edits.push(...result.edits);
        manual.push(...result.manual);
        filesWritten += result.filesWritten;
    }
    return { edits, manual, filesWritten };
}

/** Writes `content` to `file` when it changed; 1 when written, else 0. */
async function saveIfChanged(file: string, before: string, content: string, write: boolean): Promise<number> {
    if (!write || content === before) return 0;
    await fs.writeFile(file, content);
    return 1;
}

async function rewriteTarget(target: Target, rules: readonly Rule[], write: boolean): Promise<BindingCodemodReport> {
    const tsSource = await fs.readFile(target.tsPath, 'utf-8');
    const template = await readTemplate(target, tsSource);
    const tags = rewriteTemplate(template, rules);
    const ts = rewriteIdentifiers(target.inline ? tags.content : tsSource, rules);

    const edits: BindingEdit[] = [
        ...tags.edits.map((e) => ({ file: target.templatePath, ...e })),
        ...ts.edits.map((e) => ({ file: target.tsPath, ...e })),
    ];
    const manual = tags.manual.map((m) => ({ file: target.templatePath, ...m }));

    // An inline template lives in the .ts file, so one write carries both passes.
    let filesWritten = await saveIfChanged(target.tsPath, tsSource, ts.content, write);
    if (!target.inline) filesWritten += await saveIfChanged(target.templatePath, template, tags.content, write);
    return { edits, manual, filesWritten };
}

const MAX_LISTED = 12;

/** Prints the report after `update`, in the mode the flags asked for. */
export function printBindingCodemodReport(
    report: BindingCodemodReport, root: string, mode: { fix: boolean; dryRun: boolean },
): void {
    if (report.edits.length === 0 && report.manual.length === 0) return;
    const rel = (f: string): string => path.relative(root, f);
    if (!mode.fix) {
        console.log(chalk.cyan(
            `\n  ${report.edits.length} of these can be rewritten for you — run \`update --fix\` to apply them.`,
        ));
        return;
    }
    const verb = mode.dryRun ? '[Dry Run] Would rewrite' : 'Rewrote';
    console.log(chalk.green(`\n✎ ${verb} ${report.edits.length} binding(s) in your templates:`));
    for (const e of report.edits.slice(0, MAX_LISTED)) {
        console.log(chalk.dim(`    ${rel(e.file)}:${e.line}  ${e.from} → ${e.to}`));
    }
    if (report.edits.length > MAX_LISTED) console.log(chalk.dim(`    +${report.edits.length - MAX_LISTED} more`));
    for (const m of report.manual) {
        console.log(chalk.yellow(`  Needs a hand: ${rel(m.file)}:${m.line}  ${m.from} — ${m.to}`));
    }
    if (!mode.dryRun) console.log(chalk.dim('  Review with `git diff`, then `ng build` to confirm.'));
}
