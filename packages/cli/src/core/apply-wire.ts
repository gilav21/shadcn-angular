/**
 * Pure source-editing helpers for the `apply` command. The CLI ships no TS/HTML
 * parser, so these do careful, quote-aware regex/string edits (mirroring
 * `import-rewrite.ts`) and report what they did; anything they can't do
 * confidently is left to the command's snippet fallback.
 */

function escapeRegExp(s: string): string {
    return s.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract the imported symbol from an attach `import` value (`"Symbol from '…'"`). */
export function parseAttachSymbol(attachImport: string): string {
    const idx = attachImport.indexOf(' from ');
    return (idx === -1 ? attachImport : attachImport.slice(0, idx)).trim();
}

/** The module specifier for an addon directive, under the consumer's ui alias. */
export function addonImportModule(uiAlias: string, parent: string, addonName: string): string {
    const short = addonName.split('/').at(-1) ?? addonName;
    let base = uiAlias;
    while (base.endsWith('/')) base = base.slice(0, -1);
    return `${base}/${parent}/addons/${short}`;
}

/**
 * The addon's required base contract files that are absent. Compatibility is a
 * capability check, not a version/hash check: a base the dev has EDITED is still
 * compatible as long as it still ships the contract (e.g. `data-table.host.ts`).
 */
export function missingBaseFiles(required: readonly string[], exists: (relPath: string) => boolean): string[] {
    return required.filter(f => !exists(f));
}

// ── Template instances ──────────────────────────────────────────────────

export interface TemplateInstance {
    /** Index of the opening `<` in the template. */
    readonly start: number;
    /** Index of the closing `>` of the opening tag. */
    readonly tagEnd: number;
    /** The opening-tag text, `<tag … >`. */
    readonly text: string;
    /** The raw `class="…"` value, if present. */
    readonly classToken?: string;
    /** Collected identifiers: template refs (`#x`), `id`, and `data-testid`. */
    readonly ids: string[];
    /** True when the bare/bracketed attribute is already on the tag. */
    hasSelector(selector: string): boolean;
}

/** Index of the `>` that closes the tag opened at `from`, ignoring quoted `>`. */
function findTagEnd(s: string, from: number): number {
    let quote = '';
    for (let i = from; i < s.length; i++) {
        const c = s[i];
        if (quote) {
            if (c === quote) quote = '';
        } else if (c === '"' || c === "'") {
            quote = c;
        } else if (c === '>') {
            return i;
        }
    }
    return -1;
}

function tagHasSelector(text: string, selector: string): boolean {
    return new RegExp(`(?<![\\w-])\\[?${escapeRegExp(selector)}\\]?(?![\\w-])`).test(text);
}

function collectIds(text: string): string[] {
    const ids: string[] = [];
    for (const m of text.matchAll(/(?:^|\s)#([A-Za-z_][\w-]*)/g)) ids.push(m[1]);
    for (const m of text.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) ids.push(m[1]);
    for (const m of text.matchAll(/\bdata-testid\s*=\s*["']([^"']+)["']/g)) ids.push(m[1]);
    return ids;
}

/** Find every opening tag of `tag` in `template` (quote-aware; exact tag name). */
export function findTemplateInstances(template: string, tag: string): TemplateInstance[] {
    const instances: TemplateInstance[] = [];
    const opener = new RegExp(`<${escapeRegExp(tag)}(?=[\\s/>])`, 'g');
    let m: RegExpExecArray | null;
    while ((m = opener.exec(template)) !== null) {
        const start = m.index;
        const tagEnd = findTagEnd(template, start);
        if (tagEnd === -1) break;
        const text = template.slice(start, tagEnd + 1);
        const classMatch = /\bclass\s*=\s*["']([^"']*)["']/.exec(text);
        instances.push({
            start,
            tagEnd,
            text,
            classToken: classMatch?.[1],
            ids: collectIds(text),
            hasSelector: (selector: string) => tagHasSelector(text, selector),
        });
        opener.lastIndex = tagEnd + 1;
    }
    return instances;
}

export type InstanceFilter =
    | { readonly mode: 'all' }
    | { readonly mode: 'class'; readonly token: string }
    | { readonly mode: 'id'; readonly token: string };

/** Narrow instances by an instance-selection filter (`--all`/`--class`/`--id`). */
export function filterInstances(instances: TemplateInstance[], filter: InstanceFilter): TemplateInstance[] {
    if (filter.mode === 'all') return instances;
    if (filter.mode === 'class') {
        return instances.filter(i => (i.classToken ?? '').split(/\s+/).includes(filter.token));
    }
    return instances.filter(i => i.ids.includes(filter.token));
}

/** Instance-selection flags from the `apply` command. */
export interface InstanceSelectionOptions {
    readonly all?: boolean;
    readonly class?: string;
    readonly id?: string;
    readonly yes?: boolean;
}

/** Map the instance-selection flags to a filter, or null when none was given. */
export function filterFromOptions(options: InstanceSelectionOptions): InstanceFilter | null {
    if (options.all) return { mode: 'all' };
    if (options.class !== undefined) return { mode: 'class', token: options.class };
    if (options.id !== undefined) return { mode: 'id', token: options.id };
    return null;
}

/** A chosen instance set, or a signal to prompt / fall back to a snippet. */
export type InstanceDecision =
    | { readonly kind: 'instances'; readonly instances: TemplateInstance[] }
    | { readonly kind: 'snippet' }
    | { readonly kind: 'prompt' };

/**
 * Decide which instances to wire without doing IO: an explicit flag filters; a
 * single unwired instance auto-selects; otherwise it's ambiguous — 'snippet'
 * non-interactively (`--yes`), else 'prompt' to ask the dev.
 */
export function decideInstances(
    selector: string, all: TemplateInstance[], options: InstanceSelectionOptions,
): InstanceDecision {
    const filter = filterFromOptions(options);
    if (filter) {
        const matched = filterInstances(all, filter);
        // An explicit filter that matches nothing → snippet (spec: "or nothing matches").
        return matched.length > 0 ? { kind: 'instances', instances: matched } : { kind: 'snippet' };
    }
    const unwired = all.filter(i => !i.hasSelector(selector));
    if (unwired.length <= 1) return { kind: 'instances', instances: all };
    if (options.yes) return { kind: 'snippet' };
    return { kind: 'prompt' };
}

/** Insert the bare attribute on the given instances (idempotent; right-to-left). */
export function insertSelectorAtInstances(
    template: string,
    instances: TemplateInstance[],
    selector: string,
): { content: string; wired: number } {
    let content = template;
    let wired = 0;
    const ordered = [...instances].sort((a, b) => b.start - a.start);
    for (const inst of ordered) {
        if (inst.hasSelector(selector)) continue;
        // inst.text ends with '>'; insert after the core attributes, before any
        // trailing whitespace + optional self-closing '/'. (Per-char scan — no
        // backtracking regex.)
        let i = inst.text.length - 2;
        if (i >= 0 && inst.text[i] === '/') i -= 1;
        while (i >= 0 && /\s/.test(inst.text[i])) i -= 1;
        const insertAt = inst.start + i + 1;
        content = content.slice(0, insertAt) + ` ${selector}` + content.slice(insertAt);
        wired += 1;
    }
    return { content, wired };
}

/** Where a component's template lives: inline in the `.ts`, or an external file. */
export type TemplateLocation =
    | { readonly inline: true }
    | { readonly inline: false; readonly templateUrl: string };

/** Determine whether a component uses an inline `template:` or a `templateUrl`. */
export function resolveTemplateLocation(tsSource: string): TemplateLocation | null {
    const url = /\btemplateUrl\s*:\s*['"]([^'"]+)['"]/.exec(tsSource);
    if (url) return { inline: false, templateUrl: url[1] };
    if (/\btemplate\s*:\s*[`'"]/.test(tsSource)) return { inline: true };
    return null;
}

// ── Component TypeScript wiring ─────────────────────────────────────────

/**
 * Add the directive `import` and register `symbol` in the standalone
 * `@Component({ imports: [...] })` array. Idempotent. Returns null when there
 * is no imports array to edit (the caller then prints a paste snippet).
 */
/** Top-level import statements, each spanning from `import` to its terminating `;`. */
function importStatements(source: string): { end: number; text: string }[] {
    const out: { end: number; text: string }[] = [];
    for (const m of source.matchAll(/^[ \t]*import\b/gm)) {
        const start = m.index ?? 0;
        const semi = source.indexOf(';', start);
        const end = semi === -1 ? source.length : semi + 1;
        out.push({ end, text: source.slice(start, end) });
    }
    return out;
}

export function wireDirectiveImport(
    source: string,
    symbol: string,
    module: string,
): { content: string; changed: boolean } | null {
    if (!/imports\s*:\s*\[[^\]]*\]/.test(source)) return null;

    let content = source;
    let changed = false;
    const symbolWord = new RegExp(`\\b${escapeRegExp(symbol)}\\b`);

    // Import statements end at the first ';' after `import` — handles multi-line
    // `import { … }` blocks (a single-line regex would miss them and double-add).
    const imports = importStatements(content);
    const importedAlready = imports.some(stmt => symbolWord.test(stmt.text));
    if (!importedAlready) {
        const importStmt = `import { ${symbol} } from '${module}';`;
        if (imports.length > 0) {
            const at = imports[imports.length - 1].end;
            content = content.slice(0, at) + `\n${importStmt}` + content.slice(at);
        } else {
            content = `${importStmt}\n${content}`;
        }
        changed = true;
    }

    const arrayContent = /imports\s*:\s*\[([^\]]*)\]/.exec(content)?.[1] ?? '';
    if (!symbolWord.test(arrayContent)) {
        content = content.replace(/imports\s*:\s*\[/, m => `${m}${symbol}, `);
        changed = true;
    }

    return { content, changed };
}
