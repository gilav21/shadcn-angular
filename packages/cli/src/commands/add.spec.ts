import { describe, it, expect, vi } from 'vitest';
import { resolveDependencies, promptOptionalDependencies } from './add.js';
import { registry, type ComponentName, type ComponentDefinition } from '../registry/index.js';

// ---------------------------------------------------------------------------
// resolveDependencies
// ---------------------------------------------------------------------------

describe('resolveDependencies', () => {
  it('resolves a single component without dependencies', () => {
    const result = resolveDependencies(['badge']);
    expect(result).toContain('badge');
    expect(result.size).toBe(1);
  });

  it('includes transitive dependencies', () => {
    // button depends on ripple
    const result = resolveDependencies(['button']);
    expect(result).toContain('button');
    expect(result).toContain('ripple');
  });

  it('resolves deep transitive chains', () => {
    // date-picker -> calendar -> button -> ripple, calendar -> select
    const result = resolveDependencies(['date-picker']);
    expect(result).toContain('date-picker');
    expect(result).toContain('calendar');
    expect(result).toContain('button');
    expect(result).toContain('ripple');
    expect(result).toContain('select');
  });

  it('deduplicates shared dependencies across multiple inputs', () => {
    // Both button-group and speed-dial depend on button
    const result = resolveDependencies(['button-group', 'speed-dial']);
    expect(result).toContain('button-group');
    expect(result).toContain('speed-dial');
    expect(result).toContain('button');
    expect(result).toContain('ripple');

    // Count how many times button appears — should be exactly once (it's a Set)
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

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

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
    const resolved = new Set<ComponentName>(['data-table', 'table', 'input', 'button', 'ripple', 'checkbox', 'select', 'pagination', 'popover', 'component-outlet', 'icon']);
    const result = await promptOptionalDependencies(resolved, { all: true, branch: 'master' });
    expect(result).toContain('context-menu');
  });

  it('filters out optional deps already in the resolved set', async () => {
    // context-menu is already resolved, so it should not be offered
    const resolved = new Set<ComponentName>(['data-table', 'context-menu', 'table', 'input', 'button', 'ripple', 'checkbox', 'select', 'pagination', 'popover', 'component-outlet', 'icon']);
    const result = await promptOptionalDependencies(resolved, { all: true, branch: 'master' });
    expect(result).not.toContain('context-menu');
  });

  it('deduplicates optional deps across components', async () => {
    // Both data-table and tree have context-menu as optional
    const resolved = new Set<ComponentName>(['data-table', 'tree', 'table', 'input', 'button', 'ripple', 'checkbox', 'select', 'pagination', 'popover', 'component-outlet', 'icon']);
    const result = await promptOptionalDependencies(resolved, { all: true, branch: 'master' });
    const contextMenuCount = result.filter((n: string) => n === 'context-menu').length;
    expect(contextMenuCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Registry data integrity
// ---------------------------------------------------------------------------

describe('registry optional dependencies', () => {
  it('data-table has context-menu as optional dependency', () => {
    const dt = registry['data-table'];
    expect(dt.optionalDependencies).toBeDefined();
    const names = dt.optionalDependencies!.map((d: { name: string }) => d.name);
    expect(names).toContain('context-menu');
  });

  it('tree has context-menu as optional dependency', () => {
    const tree = registry['tree'];
    expect(tree.optionalDependencies).toBeDefined();
    const names = tree.optionalDependencies!.map((d: { name: string }) => d.name);
    expect(names).toContain('context-menu');
  });

  it('every optional dependency name is a valid registry key', () => {
    for (const [componentName, definition] of Object.entries(registry) as [string, ComponentDefinition][]) {
      if (!definition.optionalDependencies) continue;
      for (const opt of definition.optionalDependencies) {
        expect(
          registry[opt.name],
          `Optional dep "${opt.name}" in "${componentName}" is not a valid registry key`,
        ).toBeDefined();
      }
    }
  });

  it('every dependency name is a valid registry key', () => {
    for (const [componentName, definition] of Object.entries(registry) as [string, ComponentDefinition][]) {
      if (!definition.dependencies) continue;
      for (const dep of definition.dependencies) {
        expect(
          registry[dep],
          `Dependency "${dep}" in "${componentName}" is not a valid registry key`,
        ).toBeDefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// help command
// ---------------------------------------------------------------------------

describe('help command', () => {
  it('prints commands, optional dependencies, and component categories', async () => {
    const { help } = await import('./help.js');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    help();

    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0] as string;

    expect(output).toContain('Commands');
    expect(output).toContain('init');
    expect(output).toContain('add');
    expect(output).toContain('Optional Dependencies');
    expect(output).toContain('Available Components');
    expect(output).toContain('UI');
    expect(output).toContain('Charts');
    expect(output).toContain('Animation');

    spy.mockRestore();
  });
});
