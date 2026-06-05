import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { rewriteSpecifier, rewriteImports, type RewriteScope } from './import-rewrite.js';

const UI_DIR = path.resolve('/proj/src/components/ui');

function scope(fileDir: string, migrated = ['button', 'data-table', 'card']): RewriteScope {
  return {
    migrated: new Set(migrated),
    uiAlias: '@/components/ui',
    uiDir: UI_DIR,
    fileDir: path.resolve(fileDir),
  };
}

describe('rewriteSpecifier — in-scope rewrites', () => {
  it('rewrites the ui alias form to the folder barrel', () => {
    expect(rewriteSpecifier('@/components/ui/button.component', scope('/proj/src/app')))
      .toBe('@/components/ui/button');
  });
  it('rewrites a relative import that resolves into the ui dir', () => {
    // /proj/src/app + ../components/ui/button.component -> /proj/src/components/ui/button.component
    expect(rewriteSpecifier('../components/ui/button.component', scope('/proj/src/app')))
      .toBe('../components/ui/button');
  });
  it('strips an explicit .ts extension', () => {
    expect(rewriteSpecifier('@/components/ui/button.component.ts', scope('/proj/src/app')))
      .toBe('@/components/ui/button');
  });
  it('handles multi-word names', () => {
    expect(rewriteSpecifier('@/components/ui/data-table.component', scope('/proj/src/app')))
      .toBe('@/components/ui/data-table');
  });
});

describe('rewriteSpecifier — NOT rewritten (consumer-safety)', () => {
  it('does not rewrite a consumer file that merely shares a component name (relative)', () => {
    // The consumer's own card lives elsewhere — must be left alone.
    expect(rewriteSpecifier('./card.component', scope('/proj/src/features/checkout'))).toBeNull();
  });
  it('does not rewrite an alias that is not the ui alias', () => {
    expect(rewriteSpecifier('@/features/checkout/card.component', scope('/proj/src/app'))).toBeNull();
  });
  it('does not touch non-migrated components', () => {
    expect(rewriteSpecifier('@/components/ui/input.component', scope('/proj/src/app'))).toBeNull();
  });
  it('does not touch substring collisions', () => {
    expect(rewriteSpecifier('@/components/ui/button-group.component', scope('/proj/src/app'))).toBeNull();
    expect(rewriteSpecifier('@/components/ui/icon-button.component', scope('/proj/src/app'))).toBeNull();
  });
  it('does not match when .component is not the final segment', () => {
    expect(rewriteSpecifier('@/components/ui/my-button.component-helpers', scope('/proj/src/app'))).toBeNull();
  });
});

describe('rewriteImports (file-level)', () => {
  const s = scope('/proj/src/app');

  it('rewrites from-imports, preserving quote style and bindings', () => {
    const src = `import { ButtonComponent } from "@/components/ui/button.component";\n`;
    const { content, changed } = rewriteImports(src, s);
    expect(changed).toBe(true);
    expect(content).toBe(`import { ButtonComponent } from "@/components/ui/button";\n`);
  });
  it('rewrites export-from and dynamic import()', () => {
    const src =
      `export { X } from '@/components/ui/button.component';\n` +
      `const m = import('@/components/ui/data-table.component');\n`;
    const { content } = rewriteImports(src, s);
    expect(content).toContain(`from '@/components/ui/button'`);
    expect(content).toContain(`import('@/components/ui/data-table')`);
  });
  it('leaves comments and unrelated strings alone', () => {
    const src = `// see button.component for details\nconst v = 'button.component';\n`;
    const { content, changed } = rewriteImports(src, s);
    expect(changed).toBe(false);
    expect(content).toBe(src);
  });
  it('does not corrupt a consumer import that shares a library name', () => {
    const src = `import { CheckoutCard } from './card.component';\n`;
    const { content, changed } = rewriteImports(src, scope('/proj/src/features/checkout'));
    expect(changed).toBe(false);
    expect(content).toBe(src);
  });
  it('preserves CRLF line endings', () => {
    const src = `import { B } from '@/components/ui/button.component';\r\nconst x = 1;\r\n`;
    const { content } = rewriteImports(src, s);
    expect(content).toBe(`import { B } from '@/components/ui/button';\r\nconst x = 1;\r\n`);
  });
  it('is idempotent', () => {
    const once = rewriteImports(`import { B } from '@/components/ui/button.component';`, s).content;
    const twice = rewriteImports(once, s).content;
    expect(twice).toBe(once);
  });
});
