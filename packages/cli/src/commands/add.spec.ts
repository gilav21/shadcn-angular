import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveDependencies,
  promptOptionalDependencies,
  promptAddons,
  collectAvailableAddons,
  normalizeContent,
  fetchAndTransform,
  checkFileConflict,
  classifyComponent,
  detectConflicts,
} from './add.js';
import { registry, type ComponentName } from '../registry/index.js';
import fs from 'fs-extra';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('fs-extra', () => ({
  default: {
    existsSync: vi.fn(() => false),
    pathExists: vi.fn(() => Promise.resolve(false)),
    readFile: vi.fn(() => Promise.resolve('')),
    writeFile: vi.fn(() => Promise.resolve()),
    ensureDir: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

// Partial registry mock: keep every real component and add one folderized
// "trio + sub/" fixture so the install pipeline can be exercised against
// folder-prefixed .html / .css / sub/ paths.
vi.mock('../registry/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../registry/index.js')>();
  return {
    ...actual,
    registry: {
      ...actual.registry,
      'trio-fixture': {
        name: 'trio-fixture',
        files: [
          'trio-fixture/trio-fixture.component.ts',
          'trio-fixture/trio-fixture.component.html',
          'trio-fixture/trio-fixture.component.css',
          'trio-fixture/sub/trio-fixture-item.component.ts',
        ],
      },
    },
  };
});

const mockedFs = vi.mocked(fs);

// ---------------------------------------------------------------------------
// normalizeContent
// ---------------------------------------------------------------------------

describe('normalizeContent', () => {
  it('trims whitespace from both ends', () => {
    expect(normalizeContent('  hello  ')).toBe('hello');
  });

  it('converts CRLF to LF', () => {
    expect(normalizeContent('line1\r\nline2\r\n')).toBe('line1\nline2');
  });

  it('handles mixed line endings', () => {
    expect(normalizeContent('a\r\nb\nc\r\n')).toBe('a\nb\nc');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeContent('   \r\n  ')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// fetchAndTransform
// ---------------------------------------------------------------------------

describe('fetchAndTransform', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
  });

  it('replaces single-level relative lib imports with alias', async () => {
    const mockContent = "import { cn } from '../lib/utils';";
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockContent, { status: 200 }),
    );

    const result = await fetchAndTransform('button/button.ts', { branch: 'master', remote: true }, '@/components/lib');
    expect(result).toBe("import { cn } from '@/components/lib/utils';");
  });

  it('replaces multi-level relative lib imports with alias', async () => {
    const mockContent = "import { cn } from '../../lib/utils';";
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockContent, { status: 200 }),
    );

    const result = await fetchAndTransform('deep/nested/comp.ts', { branch: 'master', remote: true }, '@/components/lib');
    expect(result).toBe("import { cn } from '@/components/lib/utils';");
  });

  it('replaces all occurrences in a file (global regex)', async () => {
    const mockContent = [
      "import { cn } from '../lib/utils';",
      "import { foo } from '../lib/helpers';",
    ].join('\n');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockContent, { status: 200 }),
    );

    const result = await fetchAndTransform('comp.ts', { branch: 'master', remote: true }, '@/lib');
    expect(result).toBe([
      "import { cn } from '@/lib/utils';",
      "import { foo } from '@/lib/helpers';",
    ].join('\n'));
  });

  it('does not throw with replaceAll and regex (the original bug)', async () => {
    const mockContent = "import { cn } from '../lib/utils';";
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockContent, { status: 200 }),
    );

    await expect(
      fetchAndTransform('comp.ts', { branch: 'master', remote: true }, '@/lib'),
    ).resolves.not.toThrow();
  });

  it('leaves content unchanged when no lib imports exist', async () => {
    const mockContent = "import { Component } from '@angular/core';";
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockContent, { status: 200 }),
    );

    const result = await fetchAndTransform('comp.ts', { branch: 'master', remote: true }, '@/lib');
    expect(result).toBe("import { Component } from '@angular/core';");
  });

  it('does NOT rewrite lib imports in a .html template file', async () => {
    // A literal `../lib/` in template text must survive verbatim — the
    // rewrite is gated to .ts sources only.
    const mockContent = '<a href="../lib/docs">see ../lib/utils</a>';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockContent, { status: 200 }),
    );

    const result = await fetchAndTransform(
      'button/button.component.html', { branch: 'master', remote: true }, '@/components/lib',
    );
    expect(result).toBe(mockContent);
  });

  it('does NOT rewrite lib imports in a .css style file', async () => {
    const mockContent = '.x { background: url(../lib/bg.png); }';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockContent, { status: 200 }),
    );

    const result = await fetchAndTransform(
      'button/button.component.css', { branch: 'master', remote: true }, '@/components/lib',
    );
    expect(result).toBe(mockContent);
  });

  it('still rewrites lib imports in a folder-nested .ts file', async () => {
    const mockContent = "import { cn } from '../../lib/utils';";
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockContent, { status: 200 }),
    );

    const result = await fetchAndTransform(
      'accordion/sub/accordion-item.component.ts',
      { branch: 'master', remote: true },
      '@/components/lib',
    );
    expect(result).toBe("import { cn } from '@/components/lib/utils';");
  });
});

// ---------------------------------------------------------------------------
// checkFileConflict
// ---------------------------------------------------------------------------

describe('checkFileConflict', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
  });

  it('returns "missing" when file does not exist on disk', async () => {
    mockedFs.pathExists.mockResolvedValue(false as never);
    const cache = new Map<string, string>();

    const result = await checkFileConflict(
      'button/button.ts', '/project/ui', { branch: 'master', remote: true }, '@/lib', cache,
    );
    expect(result).toBe('missing');
  });

  it('returns "identical" when local and remote content match', async () => {
    const content = "import { cn } from '@/lib/utils';\nexport class Button {}";
    mockedFs.pathExists.mockResolvedValue(true as never);
    mockedFs.readFile.mockResolvedValue(content as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(content.replaceAll('@/lib/', '../lib/'), { status: 200 }),
    );
    const cache = new Map<string, string>();

    const result = await checkFileConflict(
      'button/button.ts', '/project/ui', { branch: 'master', remote: true }, '@/lib', cache,
    );
    expect(result).toBe('identical');
  });

  it('returns "changed" when local and remote content differ', async () => {
    mockedFs.pathExists.mockResolvedValue(true as never);
    mockedFs.readFile.mockResolvedValue('// local modified version' as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('// remote original version', { status: 200 }),
    );
    const cache = new Map<string, string>();

    const result = await checkFileConflict(
      'button/button.ts', '/project/ui', { branch: 'master', remote: true }, '@/lib', cache,
    );
    expect(result).toBe('changed');
  });

  it('populates the content cache on successful fetch', async () => {
    mockedFs.pathExists.mockResolvedValue(true as never);
    mockedFs.readFile.mockResolvedValue('// local' as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('// remote', { status: 200 }),
    );
    const cache = new Map<string, string>();

    await checkFileConflict(
      'button/button.ts', '/project/ui', { branch: 'master', remote: true }, '@/lib', cache,
    );
    expect(cache.has('button/button.ts')).toBe(true);
    expect(cache.get('button/button.ts')).toBe('// remote');
  });
});

// ---------------------------------------------------------------------------
// classifyComponent — peer-file decoupling
// ---------------------------------------------------------------------------

describe('classifyComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
  });

  it('returns "install" when component files are missing', async () => {
    mockedFs.pathExists.mockResolvedValue(false as never);
    const cache = new Map<string, string>();
    const peerFiles = new Set<string>();

    const result = await classifyComponent(
      'badge', '/project/ui', { branch: 'master', remote: true }, '@/lib', cache, peerFiles,
    );
    expect(result).toBe('install');
  });

  it('returns "skip" when all component files are present and identical', async () => {
    const content = '// badge content';
    mockedFs.pathExists.mockResolvedValue(true as never);
    mockedFs.readFile.mockResolvedValue(content as never);
    // A Response body can only be consumed once — return a fresh one per fetch
    // call so multi-file components compare correctly.
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(content, { status: 200 })),
    );
    const cache = new Map<string, string>();
    const peerFiles = new Set<string>();

    const result = await classifyComponent(
      'badge', '/project/ui', { branch: 'master', remote: true }, '@/lib', cache, peerFiles,
    );
    expect(result).toBe('skip');
  });

  it('returns "conflict" when own files have changed', async () => {
    mockedFs.pathExists.mockResolvedValue(true as never);
    mockedFs.readFile.mockResolvedValue('// modified locally' as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('// original remote', { status: 200 }),
    );
    const cache = new Map<string, string>();
    const peerFiles = new Set<string>();

    const result = await classifyComponent(
      'badge', '/project/ui', { branch: 'master', remote: true }, '@/lib', cache, peerFiles,
    );
    expect(result).toBe('conflict');
  });

  it('does NOT return "conflict" when only peer files have changed', async () => {
    const componentWithPeers = Object.entries(registry).find(
      ([, def]) => def.peerFiles && def.peerFiles.length > 0,
    );

    if (!componentWithPeers) {
      return;
    }

    const [name, def] = componentWithPeers;
    let readCallCount = 0;

    mockedFs.pathExists.mockResolvedValue(true as never);
    mockedFs.readFile.mockImplementation((() => {
      readCallCount++;
      if (readCallCount <= def.files.length) {
        return Promise.resolve('// identical content');
      }
      return Promise.resolve('// modified peer file');
    }) as never);

    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('// identical content', { status: 200 })),
    );

    const cache = new Map<string, string>();
    const peerFilesToUpdate = new Set<string>();

    const result = await classifyComponent(
      name as ComponentName, '/project/ui', { branch: 'master', remote: true }, '@/lib',
      cache, peerFilesToUpdate,
    );

    expect(result).toBe('skip');
    expect(peerFilesToUpdate.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// detectConflicts
// ---------------------------------------------------------------------------

describe('detectConflicts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
  });

  it('classifies missing components as toInstall', async () => {
    mockedFs.pathExists.mockResolvedValue(false as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('// content', { status: 200 }),
    );

    const components = new Set<ComponentName>(['badge']);
    const result = await detectConflicts(components, '/project/ui', { branch: 'master', remote: true }, '@/lib');

    expect(result.toInstall).toContain('badge');
    expect(result.conflicting).not.toContain('badge');
    expect(result.toSkip).not.toContain('badge');
  });

  it('classifies identical components as toSkip', async () => {
    const content = '// badge content';
    mockedFs.pathExists.mockResolvedValue(true as never);
    mockedFs.readFile.mockResolvedValue(content as never);
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(content, { status: 200 })),
    );

    const components = new Set<ComponentName>(['badge']);
    const result = await detectConflicts(components, '/project/ui', { branch: 'master', remote: true }, '@/lib');

    expect(result.toSkip).toContain('badge');
    expect(result.toInstall).not.toContain('badge');
    expect(result.conflicting).not.toContain('badge');
  });

  it('classifies changed components as conflicting', async () => {
    mockedFs.pathExists.mockResolvedValue(true as never);
    mockedFs.readFile.mockResolvedValue('// modified locally' as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('// remote content', { status: 200 }),
    );

    const components = new Set<ComponentName>(['badge']);
    const result = await detectConflicts(components, '/project/ui', { branch: 'master', remote: true }, '@/lib');

    expect(result.conflicting).toContain('badge');
    expect(result.toInstall).not.toContain('badge');
    expect(result.toSkip).not.toContain('badge');
  });

  it('populates contentCache for files it checks', async () => {
    mockedFs.pathExists.mockResolvedValue(true as never);
    mockedFs.readFile.mockResolvedValue('// local' as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('// remote', { status: 200 }),
    );

    const components = new Set<ComponentName>(['badge']);
    const result = await detectConflicts(components, '/project/ui', { branch: 'master', remote: true }, '@/lib');

    expect(result.contentCache.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Peer file filtering after overwrite selection
// ---------------------------------------------------------------------------

describe('peer file filtering logic', () => {
  it('removes peer files of declined components from peerFilesToUpdate', () => {
    const peerFilesToUpdate = new Set(['shared/peer-a.ts', 'shared/peer-b.ts', 'shared/peer-c.ts']);
    const conflicting = new Set(['compA', 'compB']);
    const toOverwrite = new Set(['compA']);
    const finalComponents = new Set(['compA']);

    const mockPeerFiles: Record<string, string[] | undefined> = {
      compA: ['shared/peer-a.ts'],
      compB: ['shared/peer-b.ts', 'shared/peer-c.ts'],
    };

    const declined = [...conflicting].filter(c => !toOverwrite.has(c));

    for (const name of declined) {
      const peerFiles = mockPeerFiles[name];
      if (!peerFiles) continue;
      for (const file of peerFiles) {
        const stillNeeded = [...finalComponents].some(fc =>
          mockPeerFiles[fc]?.includes(file),
        );
        if (!stillNeeded) {
          peerFilesToUpdate.delete(file);
        }
      }
    }

    expect(peerFilesToUpdate.has('shared/peer-a.ts')).toBe(true);
    expect(peerFilesToUpdate.has('shared/peer-b.ts')).toBe(false);
    expect(peerFilesToUpdate.has('shared/peer-c.ts')).toBe(false);
  });

  it('keeps shared peer files when another final component still needs them', () => {
    const peerFilesToUpdate = new Set(['shared/common.ts']);
    const conflicting = new Set(['compA', 'compB']);
    const toOverwrite = new Set(['compA']);
    const finalComponents = new Set(['compA']);

    const mockPeerFiles: Record<string, string[] | undefined> = {
      compA: ['shared/common.ts'],
      compB: ['shared/common.ts'],
    };

    const declined = [...conflicting].filter(c => !toOverwrite.has(c));

    for (const name of declined) {
      const peerFiles = mockPeerFiles[name];
      if (!peerFiles) continue;
      for (const file of peerFiles) {
        const stillNeeded = [...finalComponents].some(fc =>
          mockPeerFiles[fc]?.includes(file),
        );
        if (!stillNeeded) {
          peerFilesToUpdate.delete(file);
        }
      }
    }

    expect(peerFilesToUpdate.has('shared/common.ts')).toBe(true);
  });

  it('removes all peer files when all components are declined', () => {
    const peerFilesToUpdate = new Set(['shared/peer-a.ts', 'shared/peer-b.ts']);
    const declined = ['compA', 'compB'];

    const mockPeerFiles: Record<string, string[] | undefined> = {
      compA: ['shared/peer-a.ts'],
      compB: ['shared/peer-b.ts'],
    };

    for (const name of declined) {
      const peerFiles = mockPeerFiles[name];
      if (!peerFiles) continue;
      for (const file of peerFiles) {
        peerFilesToUpdate.delete(file);
      }
    }

    expect(peerFilesToUpdate.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveDependencies
// ---------------------------------------------------------------------------

describe('resolveDependencies', () => {
  it('resolves a single component without dependencies', () => {
    const result = resolveDependencies(['separator']);
    expect(result).toContain('separator');
    expect(result.size).toBe(1);
  });

  it('includes transitive dependencies', () => {
    const result = resolveDependencies(['button']);
    expect(result).toContain('button');
    expect(result).toContain('ripple');
  });

  it('resolves deep transitive chains', () => {
    const result = resolveDependencies(['date-picker']);
    expect(result).toContain('date-picker');
    expect(result).toContain('calendar');
    expect(result).toContain('button');
    expect(result).toContain('ripple');
    expect(result).toContain('select');
  });

  it('deduplicates shared dependencies across multiple inputs', () => {
    const result = resolveDependencies(['date-picker', 'sparkles']);
    expect(result).toContain('date-picker');
    expect(result).toContain('sparkles');
    expect(result).toContain('button');
    expect(result).toContain('ripple');

    const asArray = [...result];
    expect(asArray.filter((n: string) => n === 'button')).toHaveLength(1);
  });

  it('returns a Set containing all resolved names', () => {
    const result = resolveDependencies(['badge']);
    expect(result).toBeInstanceOf(Set);
  });

  it('handles components with no registry deps gracefully', () => {
    const result = resolveDependencies(['separator']);
    expect(result.size).toBe(1);
    expect(result).toContain('separator');
  });
});

// ---------------------------------------------------------------------------
// promptOptionalDependencies
// ---------------------------------------------------------------------------

describe('promptOptionalDependencies', () => {
  it('returns empty array when no components have optional deps', async () => {
    const resolved = new Set<ComponentName>(['badge', 'button', 'ripple']);
    const result = await promptOptionalDependencies(resolved, { yes: false, branch: 'master' });
    expect(result).toEqual([]);
  });

  it('returns empty array with --yes flag (skip prompts)', async () => {
    const resolved = new Set<ComponentName>(['data-table', 'table', 'input', 'button', 'ripple', 'checkbox', 'select', 'pagination', 'popover', 'component-outlet', 'icon']);
    const result = await promptOptionalDependencies(resolved, { yes: true, branch: 'master' });
    expect(result).toEqual([]);
  });

  it('returns all optional dep names with --all flag', async () => {
    const resolved = new Set<ComponentName>(['tree', 'table', 'input', 'button', 'ripple', 'checkbox', 'select', 'pagination', 'popover', 'component-outlet', 'icon']);
    const result = await promptOptionalDependencies(resolved, { all: true, branch: 'master' });
    expect(result).toContain('context-menu');
  });

  it('filters out optional deps already in the resolved set', async () => {
    const resolved = new Set<ComponentName>(['data-table', 'context-menu', 'table', 'input', 'button', 'ripple', 'checkbox', 'select', 'pagination', 'popover', 'component-outlet', 'icon']);
    const result = await promptOptionalDependencies(resolved, { all: true, branch: 'master' });
    expect(result).not.toContain('context-menu');
  });

  it('deduplicates optional deps across components', async () => {
    const resolved = new Set<ComponentName>(['data-table', 'tree', 'table', 'input', 'button', 'ripple', 'checkbox', 'select', 'pagination', 'popover', 'component-outlet', 'icon']);
    const result = await promptOptionalDependencies(resolved, { all: true, branch: 'master' });
    const contextMenuCount = result.filter((n: string) => n === 'context-menu').length;
    expect(contextMenuCount).toBe(1);
  });
});

describe('promptAddons', () => {
  it('returns [] when no resolved component declares addons', async () => {
    const resolved = new Set<ComponentName>(['button', 'badge']);
    expect(await promptAddons(resolved, { branch: 'master' })).toEqual([]);
  });

  it('returns [] with --no-addons even when addons are available', async () => {
    const resolved = new Set<ComponentName>(['data-table']);
    expect(await promptAddons(resolved, { addons: false, branch: 'master' })).toEqual([]);
  });

  it('returns [] with --yes (lean, non-interactive default)', async () => {
    const resolved = new Set<ComponentName>(['data-table']);
    expect(await promptAddons(resolved, { yes: true, branch: 'master' })).toEqual([]);
  });

  it('returns all addon keys for the resolved bases with --all', async () => {
    const resolved = new Set<ComponentName>(['data-table']);
    expect(await promptAddons(resolved, { all: true, branch: 'master' })).toContain('data-table/context-menu');
  });

  it('rejects a bare short name and asks for the full parent/addon key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const resolved = new Set<ComponentName>(['data-table']);
    const result = await promptAddons(resolved, { with: 'context-menu', branch: 'master' });
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('selects an addon by its full parent/addon key via --with', async () => {
    const resolved = new Set<ComponentName>(['data-table']);
    expect(await promptAddons(resolved, { with: 'data-table/context-menu', branch: 'master' })).toEqual(['data-table/context-menu']);
  });

  it('supports --with all', async () => {
    const resolved = new Set<ComponentName>(['data-table']);
    expect(await promptAddons(resolved, { with: 'all', branch: 'master' })).toContain('data-table/context-menu');
  });

  it('warns and ignores an unknown addon token in --with', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const resolved = new Set<ComponentName>(['data-table']);
    const result = await promptAddons(resolved, { with: 'does-not-exist', branch: 'master' });
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('skips an addon already present in the resolved set', async () => {
    const resolved = new Set<ComponentName>(['data-table', 'data-table/context-menu']);
    expect(await promptAddons(resolved, { all: true, branch: 'master' })).toEqual([]);
  });
});

describe('collectAvailableAddons (post-install discoverability)', () => {
  it('lists an addon declared by an installed base that was not itself installed', () => {
    const installed = new Set<ComponentName>(['data-table', 'button']);
    const hints = collectAvailableAddons(installed);
    expect(hints.map(h => h.addon)).toContain('data-table/context-menu');
    expect(hints.find(h => h.addon === 'data-table/context-menu')?.parent).toBe('data-table');
  });

  it('omits an addon that was itself installed (already added)', () => {
    const installed = new Set<ComponentName>(['data-table', 'data-table/context-menu']);
    expect(collectAvailableAddons(installed)).toEqual([]);
  });

  it('returns [] when no installed component declares addons', () => {
    expect(collectAvailableAddons(new Set<ComponentName>(['button', 'badge']))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Registry data integrity
// ---------------------------------------------------------------------------

describe('registry optional dependencies', () => {
  it('data-table exposes context-menu as an opt-in addon (not an optional dependency)', () => {
    const dt = registry['data-table'];
    // The old informational optionalDependency was retired in favour of a real
    // addon entry that `add`/`apply` install on demand.
    expect(dt.optionalDependencies).toBeUndefined();
    expect(dt.addons).toContain('data-table/context-menu');

    const addon = registry['data-table/context-menu'];
    expect(addon).toBeDefined();
    expect(addon.type).toBe('addon');
    expect(addon.parent).toBe('data-table');
    expect(addon.attach?.selector).toBe('uiDtContextMenu');
  });

  it('tree has context-menu as optional dependency', () => {
    const tree = registry['tree'];
    expect(tree.optionalDependencies).toBeDefined();
    const names = tree.optionalDependencies!.map((d: { name: string }) => d.name);
    expect(names).toContain('context-menu');
  });

  it('every optional dependency name is a valid registry key', () => {
    for (const [componentName, definition] of Object.entries(registry)) {
      if (!definition.optionalDependencies) continue;
      for (const opt of definition.optionalDependencies) {
        expect(
          opt.name in registry,
          `Optional dep "${opt.name}" in "${componentName}" is not a valid registry key`,
        ).toBe(true);
      }
    }
  });

  it('every dependency name is a valid registry key', () => {
    for (const [componentName, definition] of Object.entries(registry)) {
      if (!definition.dependencies) continue;
      for (const dep of definition.dependencies) {
        expect(
          dep in registry,
          `Dependency "${dep}" in "${componentName}" is not a valid registry key`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Install pipeline — folderized trio + sub/ component
// ---------------------------------------------------------------------------

describe('install pipeline for a trio + sub/ component', () => {
  const TRIO = 'trio-fixture' as ComponentName;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
  });

  it('registers a folderized component with .html/.css/sub/ files', () => {
    expect(registry[TRIO].files).toEqual([
      'trio-fixture/trio-fixture.component.ts',
      'trio-fixture/trio-fixture.component.html',
      'trio-fixture/trio-fixture.component.css',
      'trio-fixture/sub/trio-fixture-item.component.ts',
    ]);
  });

  it('classifies the component for install when all trio/sub files are missing', async () => {
    mockedFs.pathExists.mockResolvedValue(false as never);
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('// content', { status: 200 })),
    );

    const result = await classifyComponent(
      TRIO, '/project/ui', { branch: 'master', remote: true }, '@/lib',
      new Map(), new Set(),
    );
    expect(result).toBe('install');
  });

  it('skips the component when every trio/sub file is present and identical', async () => {
    const content = '// shared identical content';
    mockedFs.pathExists.mockResolvedValue(true as never);
    mockedFs.readFile.mockResolvedValue(content as never);
    // A fresh Response per fetch — the body is single-use, and the four
    // trio/sub files trigger four fetches.
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(content, { status: 200 })),
    );

    const result = await classifyComponent(
      TRIO, '/project/ui', { branch: 'master', remote: true }, '@/components/lib',
      new Map(), new Set(),
    );
    expect(result).toBe('skip');
  });

  it('detectConflicts routes a missing trio + sub/ component to toInstall', async () => {
    mockedFs.pathExists.mockResolvedValue(false as never);
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('// content', { status: 200 })),
    );

    const result = await detectConflicts(
      new Set<ComponentName>([TRIO]), '/project/ui',
      { branch: 'master', remote: true }, '@/lib',
    );
    expect(result.toInstall).toContain(TRIO);
    expect(result.conflicting).not.toContain(TRIO);
  });
});

// ---------------------------------------------------------------------------
// help command
// ---------------------------------------------------------------------------

describe('help command', () => {
  it('prints commands, addons, and component categories', async () => {
    const { help } = await import('./help.js');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    help();

    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0] as string;

    expect(output).toContain('Commands');
    expect(output).toContain('init');
    expect(output).toContain('add');
    expect(output).toContain('Addons');
    expect(output).toContain('apply');
    expect(output).toContain('update');
    expect(output).toContain('Available Components');
    expect(output).toContain('Form');
    expect(output).toContain('Navigation');
    expect(output).toContain('Charts');
    expect(output).toContain('Animation');

    spy.mockRestore();
  });
});
