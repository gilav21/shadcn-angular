import { describe, it, expect } from 'vitest';
import { rewriteSpecifier, rewriteImports } from './import-rewrite.js';

const migrated = new Set(['button', 'data-table']);

describe('rewriteSpecifier', () => {
  it('rewrites alias and relative forms to the folder barrel', () => {
    expect(rewriteSpecifier('@/components/ui/button.component', migrated)).toBe('@/components/ui/button');
    expect(rewriteSpecifier('./button.component', migrated)).toBe('./button');
    expect(rewriteSpecifier('../../ui/button.component', migrated)).toBe('../../ui/button');
  });
  it('strips an explicit .ts extension', () => {
    expect(rewriteSpecifier('./button.component.ts', migrated)).toBe('./button');
  });
  it('handles multi-word component names', () => {
    expect(rewriteSpecifier('@/components/ui/data-table.component', migrated)).toBe('@/components/ui/data-table');
  });
  it('does not touch non-migrated components', () => {
    expect(rewriteSpecifier('@/components/ui/input.component', migrated)).toBeNull();
  });
  it('does not touch substring collisions', () => {
    expect(rewriteSpecifier('@/components/ui/button-group.component', migrated)).toBeNull();
    expect(rewriteSpecifier('@/components/ui/icon-button.component', migrated)).toBeNull();
  });
  it('does not match when .component is not the final segment', () => {
    expect(rewriteSpecifier('@/ui/my-button.component-helpers', migrated)).toBeNull();
  });
});

describe('rewriteImports (file-level)', () => {
  it('rewrites from-imports, preserving quote style and bindings', () => {
    const src = `import { ButtonComponent } from "@/components/ui/button.component";\n`;
    const { content, changed } = rewriteImports(src, migrated);
    expect(changed).toBe(true);
    expect(content).toBe(`import { ButtonComponent } from "@/components/ui/button";\n`);
  });
  it('rewrites export-from and dynamic import()', () => {
    const src =
      `export { X } from './button.component';\n` +
      `const m = import('./data-table.component');\n`;
    const { content } = rewriteImports(src, migrated);
    expect(content).toContain(`from './button'`);
    expect(content).toContain(`import('./data-table')`);
  });
  it('leaves comments and unrelated strings alone', () => {
    const src = `// see button.component for details\nconst s = 'button.component';\n`;
    const { content, changed } = rewriteImports(src, migrated);
    expect(changed).toBe(false);
    expect(content).toBe(src);
  });
  it('preserves CRLF line endings', () => {
    const src = `import { B } from './button.component';\r\nconst x = 1;\r\n`;
    const { content } = rewriteImports(src, migrated);
    expect(content).toBe(`import { B } from './button';\r\nconst x = 1;\r\n`);
  });
  it('is idempotent', () => {
    const once = rewriteImports(`import { B } from './button.component';`, migrated).content;
    const twice = rewriteImports(once, migrated).content;
    expect(twice).toBe(once);
  });
});
