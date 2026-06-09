import { describe, it, expect } from 'vitest';
import { readRootVar, readBlockVar } from './styles-vars.js';

const CSS = `
@import "tailwindcss";

:root {
    --radius: 0.625rem;
    --density: 1;         /* spacing/size multiplier */
    --motion: 1.5;
    /* --density-button:   0.75; */
    --density-card: 1.25;
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
}

.dark {
    --primary: oklch(0.985 0 0);
}
`;

describe('readRootVar', () => {
    it('reads an uncommented var from :root', () => {
        expect(readRootVar(CSS, '--radius')).toBe('0.625rem');
        expect(readRootVar(CSS, '--motion')).toBe('1.5');
    });

    it('ignores commented-out vars', () => {
        expect(readRootVar(CSS, '--density-button')).toBeNull();
    });

    it('reads an uncommented override next to commented ones', () => {
        expect(readRootVar(CSS, '--density-card')).toBe('1.25');
    });

    it('does not match a longer var name sharing the same prefix', () => {
        expect(readRootVar(CSS, '--density')).toBe('1');
        expect(readRootVar(CSS, '--primary')).toBe('oklch(0.205 0 0)');
    });

    it('does not match a var name that is a suffix of another', () => {
        expect(readRootVar(':root { --primary-foreground: red; }', '--foreground')).toBeNull();
    });

    it('returns null for a missing var', () => {
        expect(readRootVar(CSS, '--nonexistent')).toBeNull();
    });

    it('returns null when there is no :root block', () => {
        expect(readRootVar('.dark { --primary: red; }', '--primary')).toBeNull();
    });

    it('ignores a trailing comment after the value', () => {
        expect(readRootVar(CSS, '--density')).toBe('1');
    });
});

describe('readBlockVar', () => {
    it('reads a var from a named block', () => {
        expect(readBlockVar(CSS, '.dark', '--primary')).toBe('oklch(0.985 0 0)');
    });

    it('returns null when the block is missing', () => {
        expect(readBlockVar(CSS, '.light', '--primary')).toBeNull();
    });

    it('returns null when the var is missing from the block', () => {
        expect(readBlockVar(CSS, '.dark', '--radius')).toBeNull();
    });
});
