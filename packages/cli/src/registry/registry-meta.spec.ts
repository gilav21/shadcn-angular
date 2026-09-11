import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { registry, CATEGORIES } from './index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 * Registry entries that install a directive or pipe rather than a component —
 * i.e. every file they ship is a `.directive.ts` / `.pipe.ts`. Derived instead
 * of hardcoded so a directive added later is held to the same conventions.
 */
function directiveEntries() {
    return Object.entries(registry).filter(([, def]) =>
        def.files.length > 0
        && def.files.every(f => f.endsWith('.directive.ts') || f.endsWith('.pipe.ts')),
    );
}

describe('registry metadata shape', () => {
  it('exposes a frozen category taxonomy', () => {
    expect(Array.isArray(CATEGORIES)).toBe(true);
    expect(CATEGORIES).toContain('form');
    expect(CATEGORIES).toContain('charts');
  });

  it('every component has category + description + >=3 tags', () => {
    const BLOCK_CATS = ['auth', 'dashboard', 'settings', 'marketing'];
    for (const [name, def] of Object.entries(registry)) {
      expect(def.category, `${name}.category`).toBeDefined();
      expect(CATEGORIES as readonly string[]).toContain(def.category);
      expect(def.description, `${name}.description`).toBeTruthy();
      expect((def.description ?? '').length, `${name}.description length`).toBeLessThanOrEqual(140);
      expect((def.tags ?? []).length, `${name}.tags`).toBeGreaterThanOrEqual(3);
      if (def.type === 'block') {
        expect(BLOCK_CATS, `${name}.category (block)`).toContain(def.category);
      }
    }
  });
});

// T-14 — directives are discoverable AS directives. They share the registry's
// flat namespace with components, so the only thing distinguishing them in
// `search` / `why` / MCP output is the description. Lock that in.
describe('directive discoverability', () => {
  it('finds the directive-only entries', () => {
    // Guards the derivation itself: if this drops to zero (e.g. a refactor
    // renames `.directive.ts`), the convention test below would vacuously pass.
    expect(directiveEntries().length).toBeGreaterThanOrEqual(10);
  });

  it('every directive entry describes itself as a directive', () => {
    for (const [name, def] of directiveEntries()) {
      expect(def.description ?? '', `${name}.description`).toMatch(/^Directive\b/);
    }
  });

  it('documents every directive in docs/directives.md', () => {
    const doc = fs.readFileSync(path.join(REPO_ROOT, 'docs/directives.md'), 'utf-8');
    for (const [name] of directiveEntries()) {
      expect(doc, `docs/directives.md is missing \`${name}\``).toContain(`\`${name}\``);
    }
  });
});

/**
 * `[customToolbarItems]` / `(customToolbarAction)` were removed and then
 * restored inside one PR: adding a toolbar button from data is the DX the
 * editor promises. No breaking entry may tell a consumer otherwise, or
 * `update` would print a migration for an input that still works.
 */
describe('rich-text-editor custom toolbar API', () => {
  it('carries no breaking entry claiming customToolbarItems was removed', () => {
    const stale = (registry['rich-text-editor'].breaking ?? []).filter(c =>
      c.from.includes('customToolbarItems') || c.from.includes('customToolbarAction'),
    );
    expect(stale).toEqual([]);
  });
});

describe('committed registry.json presets', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'packages/components/registry.json'), 'utf-8'),
  ) as Record<string, { presets?: Record<string, string[]> }>;

  it('carries presets for rich-text-editor after sync-registry --fix (T-31)', () => {
    const presets = manifest['rich-text-editor']?.presets;
    expect(presets, 'registry.json lost `presets` — re-run sync-registry --fix').toBeDefined();
    expect(Object.keys(presets!)).toEqual(['core', 'writing', 'media', 'styling', 'everything']);
    expect(presets!['writing']).toEqual([
      'rich-text-editor/slash-commands',
      'rich-text-editor/links',
      'rich-text-editor/history',
      'rich-text-editor/outline',
    ]);
  });

  it('carries presets for data-table (T-31)', () => {
    const presets = manifest['data-table']?.presets;
    expect(presets).toBeDefined();
    expect(presets!['reporting']).toEqual(['data-table/export', 'data-table/pivot']);
  });

  it('matches the CLI registry literal, which is the source of truth (T-31)', () => {
    for (const [name, def] of Object.entries(registry)) {
      if (!def.presets) continue;
      expect(manifest[name]?.presets, `${name} presets drifted between the literal and registry.json`)
        .toEqual(def.presets);
    }
  });
});

// T-31
describe('rich-text-view registry entry', () => {
  it('exists with the editor as its only dependency and no npm dependencies', () => {
    const def = registry['rich-text-view'];
    expect(def).toBeDefined();
    expect(def.category).toBe('editor');
    expect(def.description!.length).toBeLessThanOrEqual(140);
    expect((def.tags ?? []).length).toBeGreaterThanOrEqual(3);
    expect(def.dependencies).toEqual(['rich-text-editor']);
    expect(def.npmDependencies ?? []).toEqual([]);
  });

  it('ships the view trio and records the actions addon as a test dependency', () => {
    const def = registry['rich-text-view'];
    expect(def.files).toContain('rich-text-view/rich-text-view.component.ts');
    expect(def.files).toContain('rich-text-view/rich-text-view.component.html');
    expect(def.files).toContain('rich-text-view/index.ts');
    expect(def.testDependencies ?? []).toContain('rich-text-editor/actions');
  });
});

// T-42
describe('rich-text-editor breaking notes after the locale cascade', () => {
  it('no note claims addon strings ignore the editor locale', () => {
    const offenders = Object.entries(registry).flatMap(([name, def]) =>
      (def.breaking ?? [])
        .filter(c => c.note.includes("not the editor's [locale]"))
        .map(() => name),
    );
    expect(offenders).toEqual([]);
  });

  it('every addon-locale note tells the reader the editor locale is inherited', () => {
    const notes = (registry['rich-text-editor'].breaking ?? [])
      .filter(c => c.note.includes('or the global UI_LOCALE_ID'));
    expect(notes.length).toBeGreaterThanOrEqual(9);
    for (const change of notes) {
      expect(change.note, change.from).toContain("otherwise inherit the editor's [locale]");
    }
  });

});
