import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { planMigration, rewriteProjectImports, deleteLegacyFiles } from './migrate-core.js';

describe('planMigration', () => {
  it('migrates legacy components, refreshes current, and pulls newly-required deps', () => {
    // button depends on ripple; with ripple not installed it becomes a new dep.
    const plan = planMigration({ legacy: ['button'], current: ['badge'] });
    expect(plan.structural).toEqual(['button']);
    expect(plan.refresh).toEqual(['badge']);
    expect(plan.migratedNames.has('button')).toBe(true);
    expect(plan.newDeps).toContain('ripple');
  });

  it('returns an empty structural plan when nothing is legacy', () => {
    const plan = planMigration({ legacy: [], current: ['button', 'ripple'] });
    expect(plan.structural).toEqual([]);
    expect(plan.newDeps).toEqual([]);
    expect(plan.migratedNames.size).toBe(0);
  });
});

describe('rewriteProjectImports', () => {
  it('rewrites imports across project source files, skipping node_modules', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mig-'));
    try {
      await fs.outputFile(
        path.join(dir, 'src/app.component.ts'),
        `import { B } from '@/components/ui/button.component';\n`,
      );
      await fs.outputFile(
        path.join(dir, 'node_modules/x/y.ts'),
        `import { B } from '@/components/ui/button.component';\n`,
      );

      const changed = await rewriteProjectImports(dir, new Set(['button']));

      expect(changed).toHaveLength(1);
      expect(await fs.readFile(path.join(dir, 'src/app.component.ts'), 'utf-8'))
        .toContain(`from '@/components/ui/button'`);
      // node_modules must be left untouched.
      expect(await fs.readFile(path.join(dir, 'node_modules/x/y.ts'), 'utf-8'))
        .toContain('button.component');
    } finally {
      await fs.remove(dir);
    }
  });

  it('no-ops when there are no migrated names', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mig-'));
    try {
      await fs.outputFile(path.join(dir, 'src/a.ts'), `import { B } from './button.component';\n`);
      const changed = await rewriteProjectImports(dir, new Set());
      expect(changed).toEqual([]);
    } finally {
      await fs.remove(dir);
    }
  });

  it('skips the ui dir so a component barrel self-reference is not rewritten', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mig-'));
    const ui = path.join(dir, 'src/components/ui');
    try {
      // The migrated component's own barrel: an intra-folder reference that
      // must survive (button/button.component.ts still exists post-migration).
      await fs.outputFile(path.join(ui, 'button/index.ts'), `export * from './button.component';\n`);
      // Consumer code outside ui/ must still be rewritten.
      await fs.outputFile(path.join(dir, 'src/app.ts'), `import { B } from '@/components/ui/button.component';\n`);

      const changed = await rewriteProjectImports(dir, new Set(['button']), [ui]);

      expect(await fs.readFile(path.join(ui, 'button/index.ts'), 'utf-8')).toContain(`'./button.component'`);
      expect(await fs.readFile(path.join(dir, 'src/app.ts'), 'utf-8')).toContain(`'@/components/ui/button'`);
      expect(changed).toHaveLength(1);
    } finally {
      await fs.remove(dir);
    }
  });
});

describe('deleteLegacyFiles', () => {
  it('deletes the legacy flat files for a migrated component only', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'del-'));
    try {
      await fs.outputFile(path.join(dir, 'button.component.ts'), 'x');
      await fs.outputFile(path.join(dir, 'button.component.html'), 'x');
      await fs.outputFile(path.join(dir, 'input.component.ts'), 'x'); // not migrated

      const deleted = await deleteLegacyFiles(dir, ['button']);

      expect(deleted).toContain('button.component.ts');
      expect(deleted).toContain('button.component.html');
      expect(await fs.pathExists(path.join(dir, 'button.component.ts'))).toBe(false);
      expect(await fs.pathExists(path.join(dir, 'input.component.ts'))).toBe(true);
    } finally {
      await fs.remove(dir);
    }
  });
});
