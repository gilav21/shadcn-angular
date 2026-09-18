/**
 * The compiled stylesheet each npm package ships as `styles.css`.
 *
 * The components' templates are Tailwind utility classes. Leaving the CSS
 * generation to the consumer meant every consumer had to install Tailwind, wire
 * PostCSS and point `@source` into `node_modules` — and a wrong path failed
 * SILENTLY, as an unstyled editor. So the package compiles its own utilities at
 * build time, and a consumer imports one file (which `ng add` does for them).
 *
 * A stylesheet dropped into someone else's app must not restyle that app:
 *
 * - no global preflight: Tailwind's reset is re-scoped to the package's own
 *   elements (`ui-*` hosts and `[data-slot]` parts, plus their descendants);
 * - no `html` / `body` rules;
 * - every token — ours and Tailwind's theme variables — is declared under
 *   `:where(...)`, specificity zero, so tokens the app defines itself win
 *   whatever the stylesheet order.
 *
 * Pure string→string functions; `package-styles.ts` runs the Tailwind compile.
 */
import postcss, { type AtRule, type Node, type Plugin, type Rule } from 'postcss';

import { toPackageTheme } from './stage-package-lib.js';

/** Where the compiled stylesheet lands, relative to the package folder. */
export const STYLES_FILE = 'styles.css';

const ELEMENT_SELECTOR_RE = /selector:\s*['"`]([^'"`]+)['"`]/g;

/** Every `ui-*` element selector declared by the staged components. */
export function elementSelectors(sources: Iterable<string>): readonly string[] {
    const tags = new Set<string>();
    for (const source of sources) {
        const parts = [...source.matchAll(ELEMENT_SELECTOR_RE)].flatMap((match) => match[1].split(','));
        for (const tag of parts.map((part) => part.trim())) {
            if (/^ui-[a-z\d-]+$/.test(tag)) tags.add(tag);
        }
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
}

/** The `:where(...)` argument matching a package element or anything inside one. */
export function scopeList(tags: readonly string[]): string {
    return [...tags, '[data-slot]'].flatMap((root) => [root, `${root} *`]).join(', ');
}

/** Index of the first `::` pseudo-element outside any parentheses, or -1. */
function pseudoElementIndex(selector: string): number {
    let depth = 0;
    for (let i = 0; i < selector.length; i++) {
        const ch = selector[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (depth === 0 && ch === ':' && selector[i + 1] === ':') return i;
    }
    return -1;
}

/** Selectors that style the document itself — never shipped by a package. */
const DOCUMENT_SELECTORS = new Set(['html', ':host', 'body']);

/**
 * Restricts one compound selector to package elements without changing its
 * specificity: `hr` → `hr:where(scope)`, `::after` → `*:where(scope)::after`.
 * The scope attaches to the SUBJECT, before any pseudo-element, because a
 * pseudo-element must end the selector.
 */
export function scopeSelector(selector: string, scope: string): string | null {
    const trimmed = selector.trim();
    if (DOCUMENT_SELECTORS.has(trimmed)) return null;

    const at = pseudoElementIndex(trimmed);
    const subject = at === -1 ? trimmed : trimmed.slice(0, at);
    const pseudo = at === -1 ? '' : trimmed.slice(at);
    return `${subject === '' ? '*' : subject}:where(${scope})${pseudo}`;
}

function isInsideKeyframes(rule: Rule): boolean {
    let node: Node | undefined = rule.parent;
    while (node) {
        if (node.type === 'atrule' && (node as AtRule).name.endsWith('keyframes')) return true;
        node = node.parent;
    }
    return false;
}

/**
 * Applies the scope to every rule, dropping document-only selectors. Plain
 * selectors of one rule share ONE scope list — `:where(h1, h2):where(scope)` —
 * because the list names every package element and repeating it per selector
 * multiplied the reset's size several times over. Pseudo-element selectors
 * cannot live inside `:where()`, so each of those is scoped on its own.
 *
 * Everything here ends at specificity zero, so an app's own base styles win
 * ties; inside the reset, source order decides, as it does in Tailwind's.
 */
export function scopeStylesheet(css: string, scope: string): string {
    const root = postcss.parse(css);
    root.walkRules((rule) => {
        if (isInsideKeyframes(rule)) return;
        const kept = rule.selectors.map((s) => s.trim()).filter((s) => !DOCUMENT_SELECTORS.has(s));
        const plain = kept.filter((s) => pseudoElementIndex(s) === -1);
        const withPseudo = kept.filter((s) => pseudoElementIndex(s) !== -1);

        const scoped = withPseudo.map((selector) => scopeSelector(selector, scope) ?? selector);
        if (plain.length > 0) scoped.unshift(`:where(${plain.join(', ')}):where(${scope})`);

        if (scoped.length === 0) rule.remove();
        else rule.selectors = scoped;
    });
    return root.toString();
}

/** `:root` / `.dark` token blocks re-declared at specificity zero. */
const ZERO_SPECIFICITY: Readonly<Record<string, string>> = {
    ':root': ':where(:root)',
    '.dark': ':where(.dark)',
};

export interface StylesInputParts {
    /** The CLI's `tailwind.css` template (`getStylesTemplate()`). */
    readonly template: string;
    /** Tailwind's `preflight.css`. */
    readonly preflight: string;
    /** `ui-*` element selectors of the staged closure. */
    readonly tags: readonly string[];
}

/**
 * The Tailwind input compiled next to the staged `src/`. Tailwind's theme and
 * utilities layers are imported WITHOUT its global preflight, and automatic
 * source detection is off (`source(none)`) so only the package's own sources
 * are scanned — a repo-wide scan tripled the output in a trial build.
 */
export function renderStylesInput({ template, preflight, tags }: StylesInputParts): string {
    const scope = scopeList(tags);
    const tokens = postcss.parse(toPackageTheme(template));

    let templateBase = '';
    tokens.walkAtRules('layer', (layer) => {
        if (layer.params !== 'base') return;
        templateBase = (layer.nodes ?? []).map((node) => node.toString()).join('\n');
        layer.remove();
    });
    tokens.each((node) => {
        if (node.type === 'rule' && node.selector in ZERO_SPECIFICITY) {
            node.selector = ZERO_SPECIFICITY[node.selector];
        }
    });

    return [
        '@layer theme, base, components, utilities;',
        '@import "tailwindcss/theme.css" layer(theme);',
        '@import "tailwindcss/utilities.css" layer(utilities) source(none);',
        '@source "./src";',
        '',
        tokens.toString().trim(),
        '',
        '@layer base {',
        scopeStylesheet(preflight, scope).trim(),
        scopeStylesheet(templateBase, scope).trim(),
        '}',
        '',
    ].join('\n');
}

/**
 * Post-compile: Tailwind declares its theme variables on `:root, :host`. At
 * that specificity they would override an app's own Tailwind theme (a custom
 * `--spacing`, say) whenever this file loads later, so they get the same
 * `:where` treatment as our tokens.
 */
export function zeroSpecificityThemeRoot(): Plugin {
    return {
        postcssPlugin: 'package-theme-root',
        Rule(rule) {
            const compact = rule.selector.replaceAll(/\s+/g, '');
            if (compact === ':root,:host') rule.selector = ':where(:root,:host)';
        },
    };
}
