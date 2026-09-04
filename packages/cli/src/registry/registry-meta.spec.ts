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
 * T-12 — Rec 16 removed `[customToolbarItems]` / `(customToolbarAction)` with
 * no compatibility shim (pre-1.0 policy), so `update` and `diff` are the only
 * places a consumer learns their template stopped working. That notice comes
 * from this registry `breaking[]` entry, not from any code path — if the entry
 * goes missing the removal becomes silent.
 */
describe('rich-text-editor removal notice', () => {
  const change = (registry['rich-text-editor'].breaking ?? []).find(c =>
    c.from.includes('customToolbarItems'),
  );

  it('carries a removal entry naming the deleted input and output', () => {
    expect(change).toBeDefined();
    expect(change!.kind).toBe('removal');
    expect(change!.from).toContain('customToolbarAction');
  });

  it('points the consumer at the toolbar-slot replacement and the guide', () => {
    expect(change!.to).toContain('toolbarSlots');
    expect(change!.note).toContain('RichTextEditorAddonHost');
    expect(change!.note).toContain('docs/rich-text-editor.md');
  });

  it('maps every RichTextEditorRef method to its host equivalent', () => {
    for (const method of ['insertText', 'insertHtml', 'getSelectedText', 'getHtmlContent', 'focus']) {
      expect(change!.note, method).toContain(method);
    }
  });
});
