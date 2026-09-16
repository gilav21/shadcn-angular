import tailwind from '@tailwindcss/postcss';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import postcss, { type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

import { getStylesTemplate } from '../src/templates/styles.js';
import {
    elementSelectors,
    renderStylesInput,
    scopeList,
    scopeSelector,
    scopeStylesheet,
    zeroSpecificityThemeRoot,
} from './package-styles-lib.js';
import { REPO_ROOT } from './repo-fixtures.js';

const S = 'SCOPE';

describe('elementSelectors', () => {
    it('collects ui-* element selectors, including from selector lists, sorted and unique', () => {
        const sources = [
            `@Component({ selector: 'ui-table-row', template: '' })`,
            `@Component({ selector: "ui-badge, a[uiBadge]" })`,
            '@Directive({ selector: `[uiTooltip]` })',
            `@Component({ selector: 'ui-badge' })`,
        ];
        expect(elementSelectors(sources)).toEqual(['ui-badge', 'ui-table-row']);
    });
});

describe('scopeList', () => {
    it('matches each package element and anything inside one, plus data-slot parts', () => {
        expect(scopeList(['ui-a'])).toBe('ui-a, ui-a *, [data-slot], [data-slot] *');
    });
});

describe('scopeSelector', () => {
    it.each([
        ['hr', `hr:where(${S})`],
        ['abbr:where([title])', `abbr:where([title]):where(${S})`],
        ['::after', `*:where(${S})::after`],
        ['input::placeholder', `input:where(${S})::placeholder`],
        [':where(a, b)::-webkit-inner-spin-button', `:where(a, b):where(${S})::-webkit-inner-spin-button`],
    ])('scopes %s to the subject, before any pseudo-element', (selector, expected) => {
        expect(scopeSelector(selector, S)).toBe(expected);
    });

    it.each(['html', 'body', ':host', ' body '])('drops the document selector %j', (selector) => {
        expect(scopeSelector(selector, S)).toBeNull();
    });
});

describe('scopeStylesheet', () => {
    it('gives one rule\'s plain selectors a single shared scope and pseudo-elements their own', () => {
        const out = scopeStylesheet('*, ::after, h1, h2 { margin: 0 }', S);
        expect(out).toBe(`:where(*, h1, h2):where(${S}), *:where(${S})::after { margin: 0 }`);
    });

    it('drops document-only rules and document selectors from mixed rules', () => {
        const out = scopeStylesheet('html, :host { line-height: 1.5 }\nbody, p { margin: 0 }', S);
        expect(out).not.toMatch(/html|:host|body/);
        expect(out).toContain(`:where(p):where(${S})`);
    });

    it('scopes rules nested in at-rules but leaves keyframe steps alone', () => {
        const out = scopeStylesheet('@supports (x: y) { ::placeholder { color: red } }\n@keyframes k { from { opacity: 0 } }', S);
        expect(out).toContain(`*:where(${S})::placeholder`);
        expect(out).toContain('from { opacity: 0 }');
    });
});

describe('renderStylesInput', () => {
    const input = renderStylesInput({
        template: getStylesTemplate(),
        preflight: 'hr { height: 0 }',
        tags: ['ui-demo'],
    });

    it('imports Tailwind theme and utilities without preflight or automatic source detection', () => {
        expect(input).toContain('@import "tailwindcss/utilities.css" layer(utilities) source(none);');
        expect(input).toContain('@source "./src";');
        expect(input).not.toContain('@import "tailwindcss";');
        expect(input).not.toContain('preflight');
    });

    it('declares the tokens at specificity zero, never on a bare :root or .dark', () => {
        const root = postcss.parse(input);
        const selectors: string[] = [];
        root.walkRules((rule) => { selectors.push(rule.selector); });
        expect(selectors).toContain(':where(:root)');
        expect(selectors).toContain(':where(.dark)');
        expect(selectors).not.toContain(':root');
        expect(selectors).not.toContain('.dark');
    });
});

/**
 * The invariant, over the REAL compile with Tailwind's real preflight and the
 * CLI's real template: nothing in the shipped stylesheet can match an element
 * of the host app. Every rule is a utility class, a zero-specificity token
 * block, or scoped to the package's elements.
 */
describe('compiled package stylesheet', () => {
    it('contains no rule that can match an element outside the package', async () => {
        // Inside the repo: the compile resolves `tailwindcss/*.css` from the input file's folder.
        const cacheRoot = path.join(REPO_ROOT, 'node_modules', '.cache');
        mkdirSync(cacheRoot, { recursive: true });
        const dir = mkdtempSync(path.join(cacheRoot, 'pkg-styles-'));
        try {
            mkdirSync(path.join(dir, 'src'));
            writeFileSync(
                path.join(dir, 'src', 'demo.component.ts'),
                `@Component({ selector: 'ui-demo', template: '<div class="block p-4 text-primary dark:bg-muted"></div>' })`,
            );
            const require = createRequire(import.meta.url);
            const input = renderStylesInput({
                template: getStylesTemplate(),
                preflight: readFileSync(require.resolve('tailwindcss/preflight.css'), 'utf-8'),
                tags: ['ui-demo'],
            });
            const { css } = await postcss([tailwind({ base: dir }), zeroSpecificityThemeRoot()])
                .process(input, { from: path.join(dir, 'styles.input.css') });

            expect(css).toContain('.p-4');
            const offenders: string[] = [];
            postcss.parse(css).walkRules((rule: Rule) => {
                if (rule.parent?.type === 'atrule' && /keyframes$/.test((rule.parent as { name: string }).name)) return;
                for (const selector of rule.selectors) {
                    const utility = selector.startsWith('.');
                    const token = /^:where\((:root|\.dark|:root, ?:host)\)$/.test(selector);
                    const scoped = selector.includes(`:where(${scopeList(['ui-demo'])})`);
                    if (!utility && !token && !scoped) offenders.push(selector);
                }
            });
            expect(offenders).toEqual([]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 30_000);
});
