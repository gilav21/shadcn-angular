import { describe, it, expect } from 'vitest';
import {
    applyPrefixTransforms,
    DEFAULT_PREFIX,
    isValidPrefix,
} from './prefix.js';

describe('isValidPrefix', () => {
    it.each([
        ['ui', true],
        ['myapp', true],
        ['acme-ui', true],
        ['a', true],
        ['a1', true],
        ['x-y-z', true],
        ['x1-y2', true],
    ])('accepts %s', (value, expected) => {
        expect(isValidPrefix(value)).toBe(expected);
    });

    it.each([
        '',
        'Ui',           // uppercase
        '1ui',          // leading digit
        'my_app',       // underscore
        'my--ui',       // consecutive hyphens
        '-ui',          // leading hyphen
        'ui-',          // trailing hyphen
        'ui ',          // trailing whitespace
        'ui-Item',      // uppercase in segment
    ])('rejects %j', (value) => {
        expect(isValidPrefix(value)).toBe(false);
    });

    it('rejects non-string input', () => {
        expect(isValidPrefix(undefined)).toBe(false);
        expect(isValidPrefix(null)).toBe(false);
        expect(isValidPrefix(42)).toBe(false);
    });
});

describe('applyPrefixTransforms — default prefix is a no-op', () => {
    it('returns content unchanged when prefix === DEFAULT_PREFIX', () => {
        const src = `@Component({ selector: 'ui-button' })\nclass X {}\n`;
        expect(applyPrefixTransforms('button.component.ts', src, DEFAULT_PREFIX)).toBe(src);
    });
});

describe('applyPrefixTransforms — .ts files', () => {
    it('rewrites a single-quoted selector', () => {
        const src = `@Component({\n    selector: 'ui-button',\n})\nclass X {}`;
        const out = applyPrefixTransforms('button.component.ts', src, 'acme');
        expect(out).toContain(`selector: 'acme-button'`);
        expect(out).not.toContain(`'ui-button'`);
    });

    it('rewrites a double-quoted selector', () => {
        const src = `@Component({ selector: "ui-button" })`;
        const out = applyPrefixTransforms('x.component.ts', src, 'acme');
        expect(out).toContain(`selector: "acme-button"`);
    });

    it('rewrites kebab-case multi-word selectors', () => {
        const src = `selector: 'ui-accordion-trigger',`;
        const out = applyPrefixTransforms('x.component.ts', src, 'myapp');
        expect(out).toBe(`selector: 'myapp-accordion-trigger',`);
    });

    it('rewrites comma-separated selector lists', () => {
        const src = `selector: 'thead[uiTableHeader], ui-table-header',`;
        const out = applyPrefixTransforms('x.component.ts', src, 'acme');
        expect(out).toBe(`selector: 'thead[uiTableHeader], acme-table-header',`);
    });

    it('rewrites <ui-X> tags inside inline template strings', () => {
        const src = "template: `<ui-button>Click</ui-button>`,";
        const out = applyPrefixTransforms('x.component.ts', src, 'acme');
        expect(out).toBe("template: `<acme-button>Click</acme-button>`,");
    });

    it('rewrites self-closing inline-template tags', () => {
        const src = "template: `<ui-icon name=\"x\" />`,";
        const out = applyPrefixTransforms('x.component.ts', src, 'acme');
        expect(out).toContain('<acme-icon');
    });

    it('does NOT touch arbitrary string literals that start with ui-', () => {
        const src = `const url = 'https://example.com/ui-button-docs';`;
        const out = applyPrefixTransforms('x.component.ts', src, 'acme');
        expect(out).toBe(src);
    });

    it('does NOT touch comments mentioning ui-X without tag syntax', () => {
        const src = `// the canonical selector is ui-button\nclass X {}`;
        const out = applyPrefixTransforms('x.component.ts', src, 'acme');
        expect(out).toBe(src);
    });
});

describe('applyPrefixTransforms — .html files', () => {
    it('rewrites opening and closing tags', () => {
        const src = `<ui-accordion>\n  <ui-accordion-item>x</ui-accordion-item>\n</ui-accordion>`;
        const out = applyPrefixTransforms('accordion.component.html', src, 'acme');
        expect(out).toBe(
            `<acme-accordion>\n  <acme-accordion-item>x</acme-accordion-item>\n</acme-accordion>`,
        );
    });

    it('rewrites self-closing tags', () => {
        const src = `<ui-icon name="x" />`;
        const out = applyPrefixTransforms('x.html', src, 'acme');
        expect(out).toBe(`<acme-icon name="x" />`);
    });

    it('rewrites tags with attributes and bindings', () => {
        const src = `<ui-drawer-header [foo]="bar" *ngIf="ok">`;
        const out = applyPrefixTransforms('x.html', src, 'acme');
        expect(out).toBe(`<acme-drawer-header [foo]="bar" *ngIf="ok">`);
    });

    it('leaves data-slot attribute values unchanged', () => {
        const src = `<div [attr.data-slot]="'button'"><ui-button /></div>`;
        const out = applyPrefixTransforms('x.html', src, 'acme');
        expect(out).toContain(`[attr.data-slot]="'button'"`);
        expect(out).toContain(`<acme-button`);
    });

    it('does not touch text that merely contains "ui-X"', () => {
        const src = `<p>Read ui-button-docs for details.</p>`;
        const out = applyPrefixTransforms('x.html', src, 'acme');
        expect(out).toBe(src);
    });
});

describe('applyPrefixTransforms — .css files', () => {
    it('rewrites element selectors at start of rule', () => {
        const src = `ui-button { color: red; }`;
        const out = applyPrefixTransforms('x.css', src, 'acme');
        expect(out).toBe(`acme-button { color: red; }`);
    });

    it('rewrites element selectors after combinators', () => {
        const src = `.foo > ui-button, .bar + ui-icon, .baz ~ ui-x { display: none; }`;
        const out = applyPrefixTransforms('x.css', src, 'acme');
        expect(out).toBe(`.foo > acme-button, .bar + acme-icon, .baz ~ acme-x { display: none; }`);
    });

    it('rewrites descendant element selectors', () => {
        const src = `.container ui-button:hover { opacity: 1; }`;
        const out = applyPrefixTransforms('x.css', src, 'acme');
        expect(out).toBe(`.container acme-button:hover { opacity: 1; }`);
    });
});
