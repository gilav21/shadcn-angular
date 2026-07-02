# Rich Text Editor Interactive Actions Addon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `rich-text-editor/actions` addon that lets content authors attach premade click/hover actions (open dialog, show hover card, anything) to selected text and images; the actions serialize as inert `data-action-*` HTML attributes and fire developer-supplied callbacks when the rendered HTML is clicked/hovered.

**Architecture:** An Angular directive (`[uiRteActions]`) attaches to the existing `<ui-rich-text-editor>` and reaches a DI-provided `RichTextEditorAddonHost` the base editor exposes — exactly mirroring the shipped `data-table/context-menu` addon. The base editor gains three small, generic extension points (a sanitizer attribute-rule API, a markdown span-serializer hook, and the addon host with a toolbar-slot registry + selection/mutation surface); it ships zero action-specific code. A separate framework-free runtime (`bindRichTextActions`) delivers typed events on the rendered page, wrapped by a thin `[uiRichTextActions]` directive. An optional `presets/` layer provides ready-made hover-card and dialog actions/handlers built purely on the public API.

**Tech Stack:** Angular 20 (standalone components, signals, `input()`/`output()`/`computed()`, `ChangeDetectionStrategy.OnPush`), TypeScript strict, Vitest + `@angular/core/testing` TestBed, Tailwind, Playwright (e2e), the repo's shadcn-angular CLI registry tooling.

## Global Constraints

Copied verbatim from `.claude/CLAUDE.md` and `specs/rich-text-actions-addon-spec.md`. Every task's requirements implicitly include this section.

- **One component/directive/pipe per `.ts` file.** Addon sub-files live flat inside the addon folder (`addons/actions/`), following the `data-table/addons/context-menu` precedent — **no `sub/` inside an addon**, and the addon folder is `type: 'addon'`, `parent: 'rich-text-editor'`, never its own top-level component.
- **Cross-component imports go through the barrel** (`from '../button'`, never `from '../button/button.component'`). Deep imports break sync-registry boundary detection.
- **`ChangeDetectionStrategy.OnPush`** on every component. Use `input()`/`output()`/`computed()`/`signal()`, never decorators. Every component has a `class = input('')` and a `data-slot` attribute.
- **Never `ViewEncapsulation.None`.** To style outside-tree elements (overlays), apply inline styles imperatively and restore on teardown (tour component is the reference).
- **SonarQube zero issues:** no `any` (params are `Record<string, string | number | boolean>`); `readonly` on never-reassigned members (signals, computed, arrow props); cognitive complexity ≤ 15 (extract helpers, early returns); modern APIs (`element.dataset`, `Number.isNaN`, `structuredClone`, `.replaceAll`, `RegExp.exec`, `globalThis`); no negated if/else, no nested ternaries, no duplicate branches; merge duplicate imports; extract 3+ repeated unions into a type alias; `for-of` over index-based `for`; `.reduce()` always with an initial value; no empty catch.
- **No non-JSDoc comments.** JSDoc `/** */` only on public APIs; no implementation comments inside method bodies.
- **No unused declarations** — compiler enforces `noUnusedLocals`/`noUnusedParameters` (ts6133). Clean `@Component({ imports: [...] })` too.
- **Responsive (zero tolerance):** every overlay/popover/dialog needs `max-w-[calc(100vw-2rem)]`; hardcoded px width/height needs responsive breakpoints; flex toolbars wrap; padding via density system, not hardcoded `p-6`.
- **Touch (zero tolerance):** every `(mouseenter)` reveal needs a touch alternative; drag needs `(touchstart)`; 44×44px targets. Use `lib/touch.ts` (`isTouchDevice`, `onLongPress`, `onDoubleTap`).
- **Working strategy — zero assumptions:** never claim a behavior works without evidence. Task 3 begins with a discovery spec because the markdown inline-HTML passthrough behavior is unverified.
- **Testing policy:** zero test failures tolerated, including pre-existing ones. `npm run test-visual` is the full suite and must be fully green before a task is considered done. Tests must verify real behavior, not just component creation.
- **i18n:** locale strings go through `createLocaleBindings(this.locale, LOCALES)` from `../../lib/i18n`; provide at minimum `en` and `he`, with RTL verified.
- **Publish boundary:** this feature is component + lib source + registry *data* → served live from `master`, **no npm publish required** — unless implementation touches the `ComponentDefinition` shape or `isValidRegistryShape` (it must not; `addons`/`attach`/`requiresBaseFiles` already exist). Task 16 re-verifies against `packages/cli/src/registry/load.ts` before asserting.
- **Per-task review gate:** run `review-gate` after every task; advance only at score ≥ 91 (spec bar; the memory says ≥95 — use 95 as the target, 91 as the hard floor). Record the score + rationale in this plan's Completion Log and the spec's §13 Completion Log.

**Reference implementations to copy patterns from (read before writing):**
- Addon shape & DI host: `packages/components/ui/data-table/addons/context-menu/context-menu.directive.ts`, `packages/components/ui/data-table/data-table.host.ts`, `packages/components/ui/data-table/addons/context-menu/index.ts`.
- Sanitizer: `packages/components/ui/rich-text-editor/rich-text-sanitizer.service.ts` (allow-lists, `sanitizeAttributes`, `applyAllowedAttribute`, `processNodes`).
- Markdown: `packages/components/ui/rich-text-editor/rich-text-markdown.service.ts` (`spanToMarkdown` at line ~479, `inlineTagToMarkdown` dispatch at ~457).
- Editor internals: `packages/components/ui/rich-text-editor/rich-text-editor.component.ts` (`providers` at 690, `savedRange` at 1155, `restoreSelection` at 5415, `pushHistory` at 6253, `applyMutation` at 5385, `i18n` at 966, `commandRegistry` inject at 709).
- Toolbar custom items: `packages/components/ui/rich-text-editor/sub/rich-text-toolbar.component.ts:268` (`customItems`), `.html:309` (`@for custom`).
- Locale binding: `packages/components/ui/rich-text-editor/rich-text-locales.ts`, `packages/components/lib/i18n`.
- Overlay top layer (presets): the overlay memory — fixed popovers render above modals via native `showPopover()` top layer, not z-index. Reference: `packages/components/ui/tour.component.ts` for imperative outside-tree styling.

---

## File Structure

**Base editor changes (folder `packages/components/ui/rich-text-editor/`):**
- `rich-text-editor.host.ts` — **new.** `RichTextEditorAddonHost` abstract class + `RichTextToolbarSlot` / `RichTextSelectionSnapshot` interfaces. The stable addon boundary.
- `rich-text-sanitizer.service.ts` — **modify.** Add `registerAttributeRules()` contribution API + companion-attribute post-pass, keeping `href`/`src`/`style`/`class`/`on*` locked.
- `rich-text-markdown.service.ts` — **modify.** Add `registerSpanSerializer()` consulted inside `spanToMarkdown`.
- `rich-text-editor.component.ts` — **modify.** Provide the host, own the toolbar-slot registry, wire slot clicks, expose selection snapshot + `wrapSelection`/`mutateContent`/`saveSelection`/`restoreSelection`/`contentRoot`.
- `sub/rich-text-toolbar.component.ts` / `.html` — **modify.** Render host-contributed toolbar slots (top + floating) after built-ins.

**Shared lib (`packages/components/lib/`):**
- `addon-slots.ts` — **new.** `AddonSlotRegistry<S>` moved out of `data-table.host.ts` (re-exported there for back-compat).

**Addon (`packages/components/ui/rich-text-editor/addons/actions/`):**
- `index.ts` — barrel: directive, bind-directive, types, serializer, runtime, presets.
- `rich-text-actions.types.ts` — all public types (§4.1, §4.2 of spec).
- `rich-text-actions.serializer.ts` — read/write/validate/canonicalize `data-action-*` attributes.
- `rich-text-actions.directive.ts` — `[uiRteActions]` addon entry.
- `rich-text-actions-dialog.component.ts` / `.html` — attach/edit dialog (picker + generated form + tier-2 host).
- `rich-text-actions-form.component.ts` / `.html` — tier-1 generated form.
- `rich-text-actions-popover.component.ts` / `.html` — edit popover.
- `actions-runtime.ts` — framework-free `bindRichTextActions`.
- `rich-text-actions-bind.directive.ts` — `[uiRichTextActions]` render-side wrapper.
- `rich-text-actions.locales.ts` — `en`/`he` strings.
- `presets/hover-card.preset.ts`, `presets/open-dialog.preset.ts`, `presets/preset-overlay.utils.ts`, `presets/index.ts`.
- `*.spec.ts` co-located for each of the above.

**Registry / e2e / demo:**
- `packages/components/registry.json` (+ regenerated `packages/cli/src/registry/index.ts` snapshot) — via `sync-registry --fix`.
- `e2e/orchestrator/specs.ts` — one `EXPLICIT_SPECS` entry.
- `e2e/harness/rte-actions/` — multi-component demo + spec.
- `demo/` — demo page; `rich-text-actions.stories.ts` in the addon folder.

---

## Task 1: Extract `AddonSlotRegistry` to shared lib

**Files:**
- Create: `packages/components/lib/addon-slots.ts`
- Modify: `packages/components/ui/data-table/data-table.host.ts` (remove the class body at lines ~36-46, re-export instead)
- Test: `packages/components/lib/addon-slots.spec.ts`

**Interfaces:**
- Produces: `export class AddonSlotRegistry<S> { readonly slots: Signal<readonly S[]>; register(slot: S): () => void }` from `lib/addon-slots.ts`, re-exported from `data-table.host.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/components/lib/addon-slots.spec.ts
import { describe, it, expect } from 'vitest';
import { AddonSlotRegistry } from './addon-slots';

describe('AddonSlotRegistry', () => {
  it('registers a slot and exposes it via the reactive signal', () => {
    const reg = new AddonSlotRegistry<{ id: string }>();
    reg.register({ id: 'a' });
    expect(reg.slots()).toEqual([{ id: 'a' }]);
  });

  it('teardown removes exactly the registered slot instance', () => {
    const reg = new AddonSlotRegistry<{ id: string }>();
    const a = { id: 'a' };
    const b = { id: 'b' };
    reg.register(a);
    const removeB = reg.register(b);
    removeB();
    expect(reg.slots()).toEqual([a]);
  });

  it('is still re-exported from data-table.host for back-compat', async () => {
    const mod = await import('../ui/data-table/data-table.host');
    expect(mod.AddonSlotRegistry).toBe(AddonSlotRegistry);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/components/lib/addon-slots.spec.ts`
Expected: FAIL — cannot resolve `./addon-slots`.

- [ ] **Step 3: Create the lib file**

```typescript
// packages/components/lib/addon-slots.ts
import { signal, type Signal } from '@angular/core';

/**
 * A generic, addon-agnostic registry of slot contributions. Registration is
 * reactive (host templates re-render when a slot is added/removed) and returns
 * a teardown function, mirroring the `RichTextCommandRegistry` pattern. Shared
 * by every addon host (data-table, rich-text-editor).
 */
export class AddonSlotRegistry<S> {
  private readonly _slots = signal<readonly S[]>([]);
  /** Reactive view of the registered slots, read by a host template. */
  readonly slots: Signal<readonly S[]> = this._slots.asReadonly();

  /** Register a slot; returns a teardown that removes exactly this slot. */
  register(slot: S): () => void {
    this._slots.update((list) => [...list, slot]);
    return () => this._slots.update((list) => list.filter((s) => s !== slot));
  }
}
```

- [ ] **Step 4: Update `data-table.host.ts` to re-export**

Delete the `AddonSlotRegistry` class body (lines ~30-46, the JSDoc + class). Add near the top, after the existing imports:

```typescript
import { AddonSlotRegistry } from '../../lib/addon-slots';
export { AddonSlotRegistry } from '../../lib/addon-slots';
```

Remove the now-unused `signal` import if it is no longer referenced elsewhere in the file (check with the compiler — `noUnusedLocals`). Keep it if other code in the file still uses `signal`.

- [ ] **Step 5: Run tests + data-table suite**

Run: `npx vitest run packages/components/lib/addon-slots.spec.ts packages/components/ui/data-table`
Expected: PASS (new spec green; all data-table specs still green).

- [ ] **Step 6: Commit**

```bash
git add packages/components/lib/addon-slots.ts packages/components/lib/addon-slots.spec.ts packages/components/ui/data-table/data-table.host.ts
git commit -m "refactor(lib): extract AddonSlotRegistry to shared lib/addon-slots"
```

---

## Task 2: Sanitizer attribute-rule contribution API

**Files:**
- Modify: `packages/components/ui/rich-text-editor/rich-text-sanitizer.service.ts`
- Test: `packages/components/ui/rich-text-editor/rich-text-sanitizer.service.spec.ts` (append)

**Interfaces:**
- Produces (on `RichTextSanitizerService`):
  - `interface SanitizerAttributeRule { tag: string; attr: string; requiresAttr?: string; validate?: (value: string, element: HTMLElement) => string | null }`
  - `registerAttributeRules(rules: SanitizerAttributeRule[]): () => void` — ref-counted; returns teardown. Throws if any rule targets a locked attribute (`on*`, `href`, `src`, `style`, `class`).
- Consumed by: Task 5 (directive registers the four `data-action-*` rules).

**Context:** The service is `providedIn: 'root'`, so rules are app-wide and must be ref-counted (two editor instances → register twice, unregister twice, rules live until the last teardown). Rules are consulted inside `sanitizeAttributes` **after** the built-in allow-list misses and before the attribute is dropped. A post-pass removes any surviving attribute whose `requiresAttr` companion is absent.

- [ ] **Step 1: Write the failing tests**

```typescript
// append to rich-text-sanitizer.service.spec.ts
describe('attribute-rule contribution API', () => {
  const idRule = {
    tag: '*', attr: 'data-action-click',
    validate: (v: string) => (/^[\w][\w.-]*$/.test(v) ? v : null),
  };
  const paramsRule = {
    tag: '*', attr: 'data-action-click-params', requiresAttr: 'data-action-click',
    validate: (v: string) => {
      try {
        const o = JSON.parse(v);
        const ok = o && typeof o === 'object' && !Array.isArray(o) &&
          Object.values(o).every((x) => ['string', 'number', 'boolean'].includes(typeof x));
        return ok ? JSON.stringify(o) : null;
      } catch { return null; }
    },
  };

  it('allows a contributed attribute on a span', () => {
    const off = service.registerAttributeRules([idRule]);
    expect(service.sanitize('<span data-action-click="open-dialog">x</span>'))
      .toBe('<span data-action-click="open-dialog">x</span>');
    off();
  });

  it('strips a contributed attribute whose validator rejects the value', () => {
    const off = service.registerAttributeRules([idRule]);
    expect(service.sanitize('<span data-action-click="bad id!">x</span>'))
      .toBe('<span>x</span>');
    off();
  });

  it('keeps the id attr but strips invalid params JSON, then drops orphan params', () => {
    const off = service.registerAttributeRules([idRule, paramsRule]);
    const out = service.sanitize(
      '<span data-action-click="a" data-action-click-params="{bad">x</span>');
    expect(out).toBe('<span data-action-click="a">x</span>');
    off();
  });

  it('strips a params attribute with no matching id attribute (companion rule)', () => {
    const off = service.registerAttributeRules([idRule, paramsRule]);
    expect(service.sanitize('<span data-action-click-params=\'{"a":1}\'>x</span>'))
      .toBe('<span>x</span>');
    off();
  });

  it('ref-counts: rule survives until the last teardown', () => {
    const off1 = service.registerAttributeRules([idRule]);
    const off2 = service.registerAttributeRules([idRule]);
    off1();
    expect(service.sanitize('<span data-action-click="a">x</span>'))
      .toBe('<span data-action-click="a">x</span>');
    off2();
    expect(service.sanitize('<span data-action-click="a">x</span>')).toBe('<span>x</span>');
  });

  it('throws when a rule targets a locked attribute', () => {
    for (const attr of ['onclick', 'href', 'src', 'style', 'class']) {
      expect(() => service.registerAttributeRules([{ tag: '*', attr })]).toThrow();
    }
  });

  it('still strips on* handlers from an element that also carries a contributed attr', () => {
    const off = service.registerAttributeRules([idRule]);
    const out = service.sanitize('<span data-action-click="a" onclick="alert(1)">x</span>');
    expect(out).toBe('<span data-action-click="a">x</span>');
    off();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/components/ui/rich-text-editor/rich-text-sanitizer.service.spec.ts -t "attribute-rule"`
Expected: FAIL — `registerAttributeRules` is not a function.

- [ ] **Step 3: Implement the API**

Add the interface above the class:

```typescript
/**
 * A per-attribute rule an addon contributes to widen the sanitizer allow-list.
 * Locked attributes (`on*`, `href`, `src`, `style`, `class`) can never be
 * contributed — the security boundary stays centralized in this service.
 */
export interface SanitizerAttributeRule {
  /** `'*'` (any element) or a lowercase tag name. */
  tag: string;
  /** The attribute name this rule governs (lowercase). */
  attr: string;
  /** If set, this attribute is dropped unless the companion attribute survives. */
  requiresAttr?: string;
  /** Return the value to keep, or null to strip. Defaults to keeping as-is. */
  validate?: (value: string, element: HTMLElement) => string | null;
}
```

Inside the class, add fields and methods:

```typescript
private readonly LOCKED_ATTRS = new Set(['href', 'src', 'style', 'class']);
private readonly contributedRules = new Map<string, { rule: SanitizerAttributeRule; count: number }>();

/**
 * Register addon attribute rules. Ref-counted and additive; returns a teardown
 * that decrements each rule's count and removes it at zero. Throws if any rule
 * targets a locked or event-handler attribute.
 */
registerAttributeRules(rules: SanitizerAttributeRule[]): () => void {
  for (const rule of rules) {
    const attr = rule.attr.toLowerCase();
    if (this.LOCKED_ATTRS.has(attr) || this.EVENT_HANDLER_PATTERN.test(attr)) {
      throw new Error(`Cannot contribute a sanitizer rule for locked attribute "${rule.attr}".`);
    }
  }
  for (const rule of rules) {
    const key = `${rule.tag.toLowerCase()}|${rule.attr.toLowerCase()}`;
    const existing = this.contributedRules.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      this.contributedRules.set(key, { rule, count: 1 });
    }
  }
  return () => {
    for (const rule of rules) {
      const key = `${rule.tag.toLowerCase()}|${rule.attr.toLowerCase()}`;
      const entry = this.contributedRules.get(key);
      if (!entry) continue;
      entry.count -= 1;
      if (entry.count <= 0) this.contributedRules.delete(key);
    }
  };
}

private findContributedRule(tagName: string, attrName: string): SanitizerAttributeRule | undefined {
  return this.contributedRules.get(`${tagName}|${attrName}`)?.rule
    ?? this.contributedRules.get(`*|${attrName}`)?.rule;
}
```

In `sanitizeAttributes`, after the existing `isAllowed` check fails, consult contributed rules before skipping. Replace the `if (!isAllowed) { continue; }` block with:

```typescript
if (!isAllowed) {
  const rule = this.findContributedRule(tagName, attrName);
  if (!rule) continue;
  const kept = rule.validate ? rule.validate(attr.value, target) : attr.value;
  if (kept === null) continue;
  target.setAttribute(attrName, kept);
  continue;
}
```

Add a companion post-pass. In `sanitize()`, after `this.processNodes(doc.body, cleanContainer);` and before returning, call:

```typescript
this.dropOrphanCompanionAttributes(cleanContainer);
```

And implement:

```typescript
private dropOrphanCompanionAttributes(root: HTMLElement): void {
  const companions = Array.from(this.contributedRules.values())
    .map((e) => e.rule)
    .filter((r) => r.requiresAttr);
  if (companions.length === 0) return;
  for (const rule of companions) {
    const selector = `[${rule.attr}]`;
    for (const el of Array.from(root.querySelectorAll(selector))) {
      if (!el.hasAttribute(rule.requiresAttr as string)) {
        el.removeAttribute(rule.attr);
      }
    }
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run packages/components/ui/rich-text-editor/rich-text-sanitizer.service.spec.ts`
Expected: PASS (new block + all existing sanitizer tests).

- [ ] **Step 5: Commit**

```bash
git add packages/components/ui/rich-text-editor/rich-text-sanitizer.service.ts packages/components/ui/rich-text-editor/rich-text-sanitizer.service.spec.ts
git commit -m "feat(rich-text): sanitizer attribute-rule contribution API"
```

---

## Task 3: Markdown span-serializer extension (discovery-first)

**Files:**
- Modify: `packages/components/ui/rich-text-editor/rich-text-markdown.service.ts`
- Test: `packages/components/ui/rich-text-editor/rich-text-markdown.service.spec.ts` (append)

**Interfaces:**
- Produces (on `RichTextMarkdownService`):
  - `interface MarkdownSpanSerializer { serialize(element: HTMLElement, innerMarkdown: string): string | null }`
  - `registerSpanSerializer(s: MarkdownSpanSerializer): () => void`
- Consumed by: Task 5 (directive registers a serializer that emits action-span HTML).

**Context (zero-assumption discovery):** Before building the hook, prove how the current markdown→html direction treats inline HTML like `<span data-action-click="a">x</span>`. Write the discovery spec FIRST; its result decides whether Task 3 also needs a passthrough tweak.

- [ ] **Step 1: Write the discovery spec and run it to learn actual behavior**

```typescript
// append to rich-text-markdown.service.spec.ts
describe('DISCOVERY — inline-HTML passthrough (delete after Task 3)', () => {
  it('reveals what markdownToHtml does with an unknown action span', () => {
    const md = 'before <span data-action-click="a">word</span> after';
    // eslint-disable-next-line no-console
    console.log('MD->HTML:', service.markdownToHtml(md));
    expect(true).toBe(true);
  });
});
```

Run: `npx vitest run packages/components/ui/rich-text-editor/rich-text-markdown.service.spec.ts -t DISCOVERY`
Expected: PASS; **read the logged output.** Confirm whether `markdownToHtml` (verify the real method name in the service — it may be `toHtml`/`render`) preserves the `<span data-action-*>` verbatim. Record the observed string in this task's Completion Log note. Then delete the DISCOVERY describe block. (The consumer path is the base editor: markdown input → `markdownToHtml` → `sanitizer.sanitize`. If the span survives to the sanitizer, Task 2's rules keep it. If markdown parsing strips it, note it and add the minimal passthrough in Step 3.)

- [ ] **Step 2: Write the real failing tests**

```typescript
// append to rich-text-markdown.service.spec.ts
describe('span-serializer extension', () => {
  const actionSerializer = {
    serialize(el: HTMLElement, inner: string): string | null {
      const hasAction = Object.keys(el.dataset).some((k) => k.startsWith('action'));
      if (!hasAction) return null;
      const clone = el.cloneNode(false) as HTMLElement;
      clone.innerHTML = inner;
      return clone.outerHTML;
    },
  };

  it('serializes an action span as inline HTML with inner markdown preserved', () => {
    const off = service.registerSpanSerializer(actionSerializer);
    const html = '<p>hi <span data-action-click="a"><strong>bold</strong></span></p>';
    const md = service.htmlToMarkdown(html);
    expect(md).toContain('data-action-click="a"');
    expect(md).toContain('**bold**');
    off();
  });

  it('leaves mention/tag spans to the built-in handler (regression)', () => {
    const off = service.registerSpanSerializer(actionSerializer);
    expect(service.htmlToMarkdown('<p><span data-mention="alice">Alice</span></p>'))
      .toContain('@alice');
    off();
  });

  it('round-trips html->md->html losslessly for an action span', () => {
    const off = service.registerSpanSerializer(actionSerializer);
    const html = '<p><span data-action-click="a" data-action-click-params=\'{"x":1}\'>word</span></p>';
    const back = service.markdownToHtml(service.htmlToMarkdown(html));
    expect(back).toContain('data-action-click="a"');
    expect(back).toContain('data-action-click-params');
    off();
  });
});
```

Note: verify the real method names (`htmlToMarkdown`, `markdownToHtml`) against the service source and correct the test calls if they differ.

Run: `npx vitest run packages/components/ui/rich-text-editor/rich-text-markdown.service.spec.ts -t "span-serializer"`
Expected: FAIL — `registerSpanSerializer` is not a function.

- [ ] **Step 3: Implement the hook**

Add above the class:

```typescript
/** A serializer an addon registers to control how specific spans become markdown. */
export interface MarkdownSpanSerializer {
  /** Return markdown / inline-HTML for this span, or null to pass to the next handler. */
  serialize(element: HTMLElement, innerMarkdown: string): string | null;
}
```

Add a field and method to the class:

```typescript
private readonly spanSerializers: MarkdownSpanSerializer[] = [];

/** Register a span serializer consulted before the built-in mention/tag handling. Returns teardown. */
registerSpanSerializer(serializer: MarkdownSpanSerializer): () => void {
  this.spanSerializers.push(serializer);
  return () => {
    const i = this.spanSerializers.indexOf(serializer);
    if (i !== -1) this.spanSerializers.splice(i, 1);
  };
}
```

In `spanToMarkdown(element, inner)` (line ~479), consult serializers first:

```typescript
private spanToMarkdown(element: HTMLElement, inner: string): string {
  for (const serializer of this.spanSerializers) {
    const out = serializer.serialize(element, inner);
    if (out !== null) return out;
  }
  if ('mention' in element.dataset) {
    return `@${element.dataset['mention']}`;
  }
  if ('tag' in element.dataset) {
    return `#${element.dataset['tag']}`;
  }
  return inner;
}
```

If Step 1 revealed `markdownToHtml` strips inline `<span>` HTML, add the minimal passthrough it requires (only if needed — do not add speculatively) and cover it with the round-trip test above. Record the decision in the Completion Log.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run packages/components/ui/rich-text-editor/rich-text-markdown.service.spec.ts`
Expected: PASS (new block + all existing markdown tests; DISCOVERY block removed).

- [ ] **Step 5: Commit**

```bash
git add packages/components/ui/rich-text-editor/rich-text-markdown.service.ts packages/components/ui/rich-text-editor/rich-text-markdown.service.spec.ts
git commit -m "feat(rich-text): markdown span-serializer extension point"
```

---

## Task 4: `RichTextEditorAddonHost` + toolbar-slot rendering

**Files:**
- Create: `packages/components/ui/rich-text-editor/rich-text-editor.host.ts`
- Modify: `packages/components/ui/rich-text-editor/rich-text-editor.component.ts`
- Modify: `packages/components/ui/rich-text-editor/sub/rich-text-toolbar.component.ts` and `.html`
- Test: `packages/components/ui/rich-text-editor/rich-text-editor.component.spec.ts` (append)

**Interfaces:**
- Produces:
  - `abstract class RichTextEditorAddonHost` with: `readonly toolbarSlots: AddonSlotRegistry<RichTextToolbarSlot>`; `readonly commands: RichTextCommandRegistry`; `selection(): RichTextSelectionSnapshot`; `saveSelection(): void`; `restoreSelection(): void`; `mutateContent(mutate: (root: HTMLElement) => void): void`; `wrapSelection(build: () => HTMLElement): HTMLElement[]`; `readonly disabled: Signal<boolean>`; `readonly readonly: Signal<boolean>`; `readonly contentRoot: HTMLElement`.
  - `interface RichTextToolbarSlot { id: string; icon: string; tooltip: string; order?: number; isEnabled?: () => boolean; isActive?: () => boolean; onClick: (event: Event) => void }`
  - `interface RichTextSelectionSnapshot { kind: 'text' | 'image' | 'none'; text: string; range: Range | null; imageElement: HTMLImageElement | null; closestWithAttrs(attrs: readonly string[]): HTMLElement | null }`
- Consumed by: Tasks 5–8, 11 (the directive, dialog, popover, presets).

**Context:** `RichTextEditorComponent` provides itself as the host token (like `DataTableComponent` provides `DataTableAddonHost`). The editor already has `savedRange` (1155), `restoreSelection` (5415), `pushHistory` (6253), `applyMutation` (5385), `commandRegistry` (709), `editorDiv` (711). Add a `toolbarSlots` registry the component owns and the toolbar renders.

- [ ] **Step 1: Write the failing tests**

```typescript
// append to rich-text-editor.component.spec.ts — reuse the file's existing TestBed setup
import { RichTextEditorAddonHost } from './rich-text-editor.host';

describe('addon host', () => {
  it('is provided via DI as RichTextEditorAddonHost', () => {
    const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
    expect(host).toBe(component);
  });

  it('renders a registered toolbar slot after built-ins and fires its onClick', async () => {
    const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
    const clicks: Event[] = [];
    host.toolbarSlots.register({
      id: 'demo', icon: '<svg></svg>', tooltip: 'Demo', order: 500,
      onClick: (e) => clicks.push(e),
    });
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('[data-addon-slot="demo"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    expect(clicks.length).toBe(1);
  });

  it('selection() reports none when the editor is empty and unfocused', () => {
    const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
    expect(host.selection().kind).toBe('none');
  });

  it('wrapSelection wraps the current text range in the built element', () => {
    const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
    const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
    editor.innerHTML = '<p>hello world</p>';
    const textNode = editor.querySelector('p')!.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 0); range.setEnd(textNode, 5);
    const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
    host.saveSelection();
    const created = host.wrapSelection(() => {
      const s = document.createElement('span');
      s.setAttribute('data-action-click', 'a');
      return s;
    });
    expect(created.length).toBeGreaterThan(0);
    expect(editor.querySelector('span[data-action-click="a"]')?.textContent).toBe('hello');
  });

  it('mutateContent produces exactly one undoable history entry', () => {
    const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
    const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
    editor.innerHTML = '<p>abc</p>';
    const before = editor.innerHTML;
    host.mutateContent((root) => {
      const span = document.createElement('span');
      span.setAttribute('data-action-click', 'a');
      span.textContent = 'X';
      root.querySelector('p')!.appendChild(span);
    });
    component.undo();
    fixture.detectChanges();
    expect(editor.innerHTML).toBe(before);
  });
});
```

Adapt variable names (`fixture`, `component`) to the spec file's existing setup. Verify `component.undo()` is the real public undo entry point; if not, use the toolbar undo path the file already tests.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/components/ui/rich-text-editor/rich-text-editor.component.spec.ts -t "addon host"`
Expected: FAIL — `rich-text-editor.host` module not found.

- [ ] **Step 3: Create the host file**

```typescript
// packages/components/ui/rich-text-editor/rich-text-editor.host.ts
import type { Signal } from '@angular/core';
import { AddonSlotRegistry } from '../../lib/addon-slots';
import type { RichTextCommandRegistry } from './rich-text-command-registry.service';

export { AddonSlotRegistry } from '../../lib/addon-slots';

/** An addon-contributed toolbar button, rendered by the base after built-ins. */
export interface RichTextToolbarSlot {
  /** Stable id (also the `data-addon-slot` value). */
  readonly id: string;
  /** Inline SVG markup for the button glyph. */
  readonly icon: string;
  readonly tooltip: string;
  /** Sort order among slots; lower first. Default appends. */
  readonly order?: number;
  /** Return false to disable the button. Polled through signal reads. */
  readonly isEnabled?: () => boolean;
  /** Return true to render the button in its active state. */
  readonly isActive?: () => boolean;
  readonly onClick: (event: Event) => void;
}

/** A read-only snapshot of the editor's current selection / caret target. */
export interface RichTextSelectionSnapshot {
  readonly kind: 'text' | 'image' | 'none';
  /** Selected text, or '' for image / none. */
  readonly text: string;
  /** A clone of the selection range, or null. */
  readonly range: Range | null;
  /** The selected/focused image, or null. */
  readonly imageElement: HTMLImageElement | null;
  /** Nearest ancestor element carrying any of the given attributes, if the caret sits in one. */
  closestWithAttrs(attrs: readonly string[]): HTMLElement | null;
}

/**
 * The stable extension surface a rich-text-editor addon reaches through DI
 * (`inject(RichTextEditorAddonHost)`). `RichTextEditorComponent` provides
 * itself as this token; the base never imports any addon.
 */
export abstract class RichTextEditorAddonHost {
  abstract readonly toolbarSlots: AddonSlotRegistry<RichTextToolbarSlot>;
  abstract readonly commands: RichTextCommandRegistry;
  abstract selection(): RichTextSelectionSnapshot;
  abstract saveSelection(): void;
  abstract restoreSelection(): void;
  /** Run a mutation against the content root inside the editor transaction: one history entry + re-sanitize + emit. */
  abstract mutateContent(mutate: (root: HTMLElement) => void): void;
  /** Wrap the saved text selection in the built element (block-split aware); returns created elements. */
  abstract wrapSelection(build: () => HTMLElement): HTMLElement[];
  abstract readonly disabled: Signal<boolean>;
  abstract readonly readonly: Signal<boolean>;
  abstract readonly contentRoot: HTMLElement;
}
```

- [ ] **Step 4: Make the editor implement + provide the host**

In `rich-text-editor.component.ts`:

Add imports:
```typescript
import { AddonSlotRegistry } from '../../lib/addon-slots';
import {
  RichTextEditorAddonHost,
  type RichTextToolbarSlot,
  type RichTextSelectionSnapshot,
} from './rich-text-editor.host';
```

Add to `providers` (after the `NG_VALUE_ACCESSOR` entry, line ~695):
```typescript
{ provide: RichTextEditorAddonHost, useExisting: forwardRef(() => RichTextEditorComponent) },
```

Change the class declaration to extend the abstract host:
```typescript
export class RichTextEditorComponent extends RichTextEditorAddonHost implements ControlValueAccessor, OnInit, AfterViewInit, OnDestroy {
```
Add `super();` as the first line of the constructor (create one if none exists). Ensure the existing `inject()` field initializers remain — they run fine with the `extends`.

Implement the abstract members (place near the other public methods). `commands` aliases the existing `commandRegistry`; `disabled`/`readonly` alias the existing inputs (confirm their real names — likely `disabled = input(false)` and `readonly = input(false)`; if named differently, expose `readonly` getters mapping to them):

```typescript
readonly toolbarSlots = new AddonSlotRegistry<RichTextToolbarSlot>();
get commands(): RichTextCommandRegistry { return this.commandRegistry; }
get contentRoot(): HTMLElement { return this.editorDiv?.nativeElement as HTMLElement; }

selection(): RichTextSelectionSnapshot {
  const editor = this.editorDiv?.nativeElement;
  const sel = this.document.getSelection();
  const emptySnap: RichTextSelectionSnapshot = {
    kind: 'none', text: '', range: null, imageElement: null,
    closestWithAttrs: () => null,
  };
  if (!editor || !sel || sel.rangeCount === 0) return emptySnap;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return emptySnap;
  const buildClosest = (node: Node | null) => (attrs: readonly string[]) =>
    this.closestElementWithAttrs(node, attrs, editor);
  const focusedImage = this.focusedImageElement();
  if (focusedImage) {
    return { kind: 'image', text: '', range: range.cloneRange(),
      imageElement: focusedImage, closestWithAttrs: buildClosest(focusedImage) };
  }
  const text = range.toString();
  return {
    kind: text.length > 0 ? 'text' : 'none',
    text, range: range.cloneRange(), imageElement: null,
    closestWithAttrs: buildClosest(range.startContainer),
  };
}

private closestElementWithAttrs(node: Node | null, attrs: readonly string[], boundary: HTMLElement): HTMLElement | null {
  let el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  while (el && boundary.contains(el)) {
    if (attrs.some((a) => el!.hasAttribute(a))) return el;
    el = el.parentElement;
  }
  return null;
}

private focusedImageElement(): HTMLImageElement | null {
  const active = this.selectedImage ?? null;
  return active instanceof HTMLImageElement ? active : null;
}

saveSelection(): void {
  const sel = this.document.getSelection();
  const editor = this.editorDiv?.nativeElement;
  if (sel && editor && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
    this.savedRange = sel.getRangeAt(0).cloneRange();
  }
}

override restoreSelection(): void { this.restoreSelectionInternal(); }

mutateContent(mutate: (root: HTMLElement) => void): void {
  const editor = this.editorDiv?.nativeElement;
  if (!editor) return;
  mutate(editor);
  this.applyMutation({ pushHistory: true });
}

wrapSelection(build: () => HTMLElement): HTMLElement[] {
  this.restoreSelectionInternal();
  const sel = this.document.getSelection();
  const editor = this.editorDiv?.nativeElement;
  if (!sel || sel.rangeCount === 0 || !editor) return [];
  const range = sel.getRangeAt(0);
  const wrapper = build();
  const created: HTMLElement[] = [wrapper];
  try {
    range.surroundContents(wrapper);
  } catch {
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
  }
  this.applyMutation({ pushHistory: true });
  return created;
}
```

Rename the existing `private restoreSelection()` (5415) to `private restoreSelectionInternal()` and update its internal call sites (the `restoreSelection()` calls throughout the file at 2520, 2718, 2748, 2821, etc. — do a find/replace within the class body, but NOT the new public `override restoreSelection()`). Confirm `this.selectedImage` is the real field the image-resizer sets (grep `selectedImage`); if the field has another name, use it. If block-splitting across multiple blocks is needed for a multi-paragraph selection, `surroundContents` throws and the catch path handles the single-range case; multi-block selections are out of v1 scope per spec §5.3 (document that the catch path wraps the extracted fragment).

- [ ] **Step 5: Render toolbar slots**

In `sub/rich-text-toolbar.component.ts`, add an input for the slots and an output for clicks:

```typescript
import type { RichTextToolbarSlot } from '../rich-text-editor.host';
// ...
addonSlots = input<readonly RichTextToolbarSlot[]>([]);
addonSlotClick = output<{ slot: RichTextToolbarSlot; event: Event }>();

orderedAddonSlots = computed(() =>
  [...this.addonSlots()].sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000)));

addonSlotEnabled(slot: RichTextToolbarSlot): boolean {
  return slot.isEnabled ? slot.isEnabled() : true;
}
addonSlotActive(slot: RichTextToolbarSlot): boolean {
  return slot.isActive ? slot.isActive() : false;
}
```

In `sub/rich-text-toolbar.component.html`, after the custom-items `@for` block (line ~309), add:

```html
@for (slot of orderedAddonSlots(); track slot.id) {
  <button
    type="button"
    [attr.data-addon-slot]="slot.id"
    [class]="buttonClasses(slot.id)"
    [title]="slot.tooltip"
    [disabled]="interactionDisabled() || !addonSlotEnabled(slot)"
    (click)="addonSlotClick.emit({ slot, event: $event })"
  >
    <span [innerHTML]="slot.icon"></span>
  </button>
}
```

Confirm `buttonClasses` accepts an arbitrary string id (it takes a `ToolbarItem`; if it's strongly typed, add an `addonButtonClasses(active: boolean)` helper returning the same classes rather than widening `buttonClasses`). Wire the editor's template: find where `<ui-rich-text-toolbar` is used in `rich-text-editor.component.html` (top and floating instances) and bind `[addonSlots]="toolbarSlots.slots()"` and `(addonSlotClick)="onAddonSlotClick($event)"`. Add the handler to the component:

```typescript
onAddonSlotClick(payload: { slot: RichTextToolbarSlot; event: Event }): void {
  payload.slot.onClick(payload.event);
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run packages/components/ui/rich-text-editor/rich-text-editor.component.spec.ts packages/components/ui/rich-text-editor/sub/rich-text-toolbar.component.spec.ts`
Expected: PASS (new `addon host` block + all existing editor/toolbar specs).

- [ ] **Step 7: Commit**

```bash
git add packages/components/ui/rich-text-editor/rich-text-editor.host.ts packages/components/ui/rich-text-editor/rich-text-editor.component.ts packages/components/ui/rich-text-editor/rich-text-editor.component.html packages/components/ui/rich-text-editor/sub/rich-text-toolbar.component.ts packages/components/ui/rich-text-editor/sub/rich-text-toolbar.component.html packages/components/ui/rich-text-editor/rich-text-editor.component.spec.ts
git commit -m "feat(rich-text): RichTextEditorAddonHost + toolbar slot rendering"
```

---

## Task 5: Addon types, serializer, and directive skeleton

**Files:**
- Create: `packages/components/ui/rich-text-editor/addons/actions/rich-text-actions.types.ts`
- Create: `packages/components/ui/rich-text-editor/addons/actions/rich-text-actions.serializer.ts`
- Create: `packages/components/ui/rich-text-editor/addons/actions/rich-text-actions.directive.ts`
- Create: `packages/components/ui/rich-text-editor/addons/actions/index.ts`
- Test: `rich-text-actions.serializer.spec.ts`, `rich-text-actions.directive.spec.ts`

**Interfaces:**
- Produces (types.ts): `RichTextActionTrigger`, `ActionParams`, `RichTextActionField`, `RichTextActionParamsContext`, `RichTextActionParamsForm`, `RichTextActionDefinition` (see spec §4.1–4.2), plus `const ACTION_ATTRS = ['data-action-click', 'data-action-hover'] as const`.
- Produces (serializer.ts): `validateActionId(v: string): string | null`; `validateActionParams(v: string): string | null`; `writeAction(el: HTMLElement, trigger, id, params): void`; `readActions(el: HTMLElement): { trigger: RichTextActionTrigger; id: string; params: ActionParams }[]`; `removeAction(el: HTMLElement, trigger): void`; `assertFlatParams(params: unknown): asserts params is ActionParams`.
- Produces (directive.ts): `RichTextActionsDirective` selector `ui-rich-text-editor[uiRteActions]`, input `uiRteActions: RichTextActionDefinition[]`.
- Consumed by: Tasks 6–11.

- [ ] **Step 1: Write the failing serializer tests**

```typescript
// rich-text-actions.serializer.spec.ts
import { describe, it, expect } from 'vitest';
import {
  validateActionId, validateActionParams, writeAction, readActions, removeAction, assertFlatParams,
} from './rich-text-actions.serializer';

describe('action serializer', () => {
  it('validates ids', () => {
    expect(validateActionId('open-dialog')).toBe('open-dialog');
    expect(validateActionId('a.b.c')).toBe('a.b.c');
    expect(validateActionId('bad id')).toBeNull();
    expect(validateActionId('')).toBeNull();
    expect(validateActionId('<script>')).toBeNull();
  });

  it('validates + canonicalizes flat params', () => {
    expect(validateActionParams('{"a":1,"b":"x","c":true}')).toBe('{"a":1,"b":"x","c":true}');
    expect(validateActionParams('{"a":{"nested":1}}')).toBeNull();
    expect(validateActionParams('{"a":[1,2]}')).toBeNull();
    expect(validateActionParams('{"a":null}')).toBeNull();
    expect(validateActionParams('not json')).toBeNull();
  });

  it('rejects params over 4096 serialized chars', () => {
    const big = JSON.stringify({ a: 'x'.repeat(5000) });
    expect(validateActionParams(big)).toBeNull();
  });

  it('canonicalization is idempotent', () => {
    const once = validateActionParams('{"b":2,"a":1}')!;
    expect(validateActionParams(once)).toBe(once);
  });

  it('writes and reads both triggers off one element', () => {
    const el = document.createElement('span');
    writeAction(el, 'click', 'open-dialog', { dialogId: 'pricing' });
    writeAction(el, 'hover', 'term-preview', { termId: 'sla' });
    const actions = readActions(el);
    expect(actions).toEqual([
      { trigger: 'click', id: 'open-dialog', params: { dialogId: 'pricing' } },
      { trigger: 'hover', id: 'term-preview', params: { termId: 'sla' } },
    ]);
  });

  it('removeAction drops one trigger and its params, keeps the other', () => {
    const el = document.createElement('span');
    writeAction(el, 'click', 'a', { x: 1 });
    writeAction(el, 'hover', 'b', { y: 2 });
    removeAction(el, 'click');
    expect(el.hasAttribute('data-action-click')).toBe(false);
    expect(el.hasAttribute('data-action-click-params')).toBe(false);
    expect(el.getAttribute('data-action-hover')).toBe('b');
  });

  it('assertFlatParams throws on nested values', () => {
    expect(() => assertFlatParams({ a: { b: 1 } })).toThrow();
    expect(() => assertFlatParams({ a: 1, b: 'x', c: false })).not.toThrow();
  });
});
```

Run: `npx vitest run packages/components/ui/rich-text-editor/addons/actions/rich-text-actions.serializer.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Write the types file**

```typescript
// rich-text-actions.types.ts
import type { Signal, Type, WritableSignal } from '@angular/core';

export type RichTextActionTrigger = 'click' | 'hover';
export type ActionTargetKind = 'text' | 'image';

/** Flat params object — the only shape that serializes into the HTML. */
export type ActionParams = Record<string, string | number | boolean>;

/** The attribute names carrying an action id, one per trigger. */
export const ACTION_ATTRS = ['data-action-click', 'data-action-hover'] as const;

export interface RichTextActionField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select';
  required?: boolean;
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean;
  validate?: (value: unknown) => string | null;
}

export interface RichTextActionParamsContext {
  mode: 'create' | 'edit';
  trigger: RichTextActionTrigger;
  currentParams: ActionParams;
  selectionText: string;
  targetKind: ActionTargetKind;
  targetElement: HTMLElement | null;
}

export interface RichTextActionParamsForm {
  context: RichTextActionParamsContext;
  readonly params: WritableSignal<ActionParams>;
  readonly valid: Signal<boolean>;
}

export interface RichTextActionDefinition {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  triggers: RichTextActionTrigger[];
  targets?: ActionTargetKind[];
  fields?: RichTextActionField[];
  formComponent?: Type<RichTextActionParamsForm>;
  resolveParams?: (ctx: RichTextActionParamsContext) => Promise<ActionParams | null>;
}
```

- [ ] **Step 3: Write the serializer**

```typescript
// rich-text-actions.serializer.ts
import type { ActionParams, RichTextActionTrigger } from './rich-text-actions.types';

const ID_PATTERN = /^[\w][\w.-]*$/;
const MAX_PARAMS_LENGTH = 4096;
const PRIMITIVE_TYPES = new Set(['string', 'number', 'boolean']);

function idAttr(trigger: RichTextActionTrigger): string {
  return `data-action-${trigger}`;
}
function paramsAttr(trigger: RichTextActionTrigger): string {
  return `data-action-${trigger}-params`;
}

function isFlatParamsObject(value: unknown): value is ActionParams {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((v) => PRIMITIVE_TYPES.has(typeof v));
}

/** Return the id if it is a valid action id, else null. */
export function validateActionId(value: string): string | null {
  return ID_PATTERN.test(value) ? value : null;
}

/** Parse, shape-check and canonicalize params JSON; return canonical string or null. */
export function validateActionParams(value: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!isFlatParamsObject(parsed)) return null;
  const canonical = JSON.stringify(parsed);
  return canonical.length <= MAX_PARAMS_LENGTH ? canonical : null;
}

/** Assert params are a flat object of primitives (dev-facing guard before serialization). */
export function assertFlatParams(params: unknown): asserts params is ActionParams {
  if (!isFlatParamsObject(params)) {
    throw new Error('Action params must be a flat object of string | number | boolean values.');
  }
}

/** Write an action (id + params) for a trigger onto an element. */
export function writeAction(
  el: HTMLElement, trigger: RichTextActionTrigger, id: string, params: ActionParams,
): void {
  assertFlatParams(params);
  el.setAttribute(idAttr(trigger), id);
  if (Object.keys(params).length > 0) {
    el.setAttribute(paramsAttr(trigger), JSON.stringify(params));
  } else {
    el.removeAttribute(paramsAttr(trigger));
  }
}

/** Remove one trigger's action (id + params) from an element. */
export function removeAction(el: HTMLElement, trigger: RichTextActionTrigger): void {
  el.removeAttribute(idAttr(trigger));
  el.removeAttribute(paramsAttr(trigger));
}

/** Read all actions present on an element, in click-then-hover order. */
export function readActions(
  el: HTMLElement,
): { trigger: RichTextActionTrigger; id: string; params: ActionParams }[] {
  const triggers: RichTextActionTrigger[] = ['click', 'hover'];
  const out: { trigger: RichTextActionTrigger; id: string; params: ActionParams }[] = [];
  for (const trigger of triggers) {
    const id = el.getAttribute(idAttr(trigger));
    if (!id) continue;
    const raw = el.getAttribute(paramsAttr(trigger));
    out.push({ trigger, id, params: parseParams(raw) });
  }
  return out;
}

function parseParams(raw: string | null): ActionParams {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isFlatParamsObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
```

Run: `npx vitest run packages/components/ui/rich-text-editor/addons/actions/rich-text-actions.serializer.spec.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing directive tests**

```typescript
// rich-text-actions.directive.spec.ts — smoke: registration + teardown
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextSanitizerService } from '../../rich-text-sanitizer.service';
import { RichTextActionsDirective } from './rich-text-actions.directive';
import type { RichTextActionDefinition } from './rich-text-actions.types';

@Component({
  standalone: true,
  imports: [RichTextEditorComponent, RichTextActionsDirective],
  template: `<ui-rich-text-editor mode="html" [uiRteActions]="defs"></ui-rich-text-editor>`,
})
class HostCmp {
  defs: RichTextActionDefinition[] = [
    { id: 'open-dialog', label: 'Open dialog', triggers: ['click'],
      fields: [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }] },
  ];
}

describe('RichTextActionsDirective', () => {
  it('registers a toolbar slot + sanitizer rules when defs are present', () => {
    const fixture = TestBed.createComponent(HostCmp);
    fixture.detectChanges();
    const sanitizer = TestBed.inject(RichTextSanitizerService);
    expect(sanitizer.sanitize('<span data-action-click="open-dialog">x</span>'))
      .toBe('<span data-action-click="open-dialog">x</span>');
    const slotBtn = fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]');
    expect(slotBtn).toBeTruthy();
  });

  it('registers nothing when defs are empty', () => {
    const fixture = TestBed.createComponent(HostCmp);
    fixture.componentInstance.defs = [];
    fixture.detectChanges();
    const sanitizer = TestBed.inject(RichTextSanitizerService);
    expect(sanitizer.sanitize('<span data-action-click="a">x</span>')).toBe('<span>x</span>');
    expect(fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]')).toBeFalsy();
  });

  it('tears down registrations on destroy', () => {
    const fixture = TestBed.createComponent(HostCmp);
    fixture.detectChanges();
    fixture.destroy();
    const sanitizer = TestBed.inject(RichTextSanitizerService);
    expect(sanitizer.sanitize('<span data-action-click="open-dialog">x</span>'))
      .toBe('<span>x</span>');
  });
});
```

Run: `npx vitest run packages/components/ui/rich-text-editor/addons/actions/rich-text-actions.directive.spec.ts`
Expected: FAIL — directive module not found.

- [ ] **Step 5: Write the directive skeleton**

```typescript
// rich-text-actions.directive.ts
import {
  Directive, DestroyRef, effect, inject, input, output, ViewContainerRef,
} from '@angular/core';
import { RichTextEditorAddonHost } from '../../rich-text-editor.host';
import { RichTextSanitizerService } from '../../rich-text-sanitizer.service';
import { RichTextMarkdownService } from '../../rich-text-markdown.service';
import { validateActionId, validateActionParams } from './rich-text-actions.serializer';
import { ACTION_ATTRS, type RichTextActionDefinition } from './rich-text-actions.types';

const ATTACH_COMMAND_ID = 'actions.attach';
const ATTACH_SLOT_ID = 'actions.attach';
const ATTACH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

/**
 * Opt-in actions addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides; contributes the "Attach action"
 * toolbar button + `/action` slash command, widens the sanitizer allow-list
 * for `data-action-*` attributes, and teaches markdown to preserve action
 * spans. Renders its dialog/popover imperatively — the base ships no action code.
 */
@Directive({
  selector: 'ui-rich-text-editor[uiRteActions]',
  standalone: true,
})
export class RichTextActionsDirective {
  private readonly host = inject(RichTextEditorAddonHost);
  private readonly sanitizer = inject(RichTextSanitizerService);
  private readonly markdown = inject(RichTextMarkdownService);
  private readonly vcr = inject(ViewContainerRef);

  readonly uiRteActions = input<RichTextActionDefinition[]>([]);
  readonly uiRteActionsToolbar = input(true);
  readonly uiRteActionsSlashCommand = input(true);

  readonly actionAttached = output<{
    actionId: string; trigger: 'click' | 'hover'; params: Record<string, string | number | boolean>; targetKind: 'text' | 'image';
  }>();
  readonly actionRemoved = output<{
    actionId: string; trigger: 'click' | 'hover'; targetKind: 'text' | 'image';
  }>();

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect((onCleanup) => {
      if (this.uiRteActions().length === 0) return;
      const off = this.sanitizer.registerAttributeRules([
        { tag: '*', attr: 'data-action-click', validate: validateActionId },
        { tag: '*', attr: 'data-action-hover', validate: validateActionId },
        { tag: '*', attr: 'data-action-click-params', requiresAttr: 'data-action-click', validate: validateActionParams },
        { tag: '*', attr: 'data-action-hover-params', requiresAttr: 'data-action-hover', validate: validateActionParams },
      ]);
      onCleanup(off);
    });

    effect((onCleanup) => {
      if (this.uiRteActions().length === 0) return;
      const off = this.markdown.registerSpanSerializer({
        serialize: (el, inner) => {
          const hasAction = ACTION_ATTRS.some((a) => el.hasAttribute(a));
          if (!hasAction) return null;
          const clone = el.cloneNode(false) as HTMLElement;
          clone.innerHTML = inner;
          return clone.outerHTML;
        },
      });
      onCleanup(off);
    });

    effect((onCleanup) => {
      if (this.uiRteActions().length === 0 || !this.uiRteActionsToolbar()) return;
      const off = this.host.toolbarSlots.register({
        id: ATTACH_SLOT_ID, icon: ATTACH_ICON, tooltip: 'Attach action', order: 500,
        isEnabled: () => this.canAttach(),
        onClick: () => this.openAttachFlow(),
      });
      onCleanup(off);
    });

    effect((onCleanup) => {
      if (this.uiRteActions().length === 0 || !this.uiRteActionsSlashCommand()) return;
      const off = this.host.commands.registerCommand({
        id: ATTACH_COMMAND_ID, label: 'Attach action',
        description: 'Attach a click or hover action to the selection',
        keywords: ['action', 'link', 'dialog', 'hover'], order: 220,
        when: (ctx) => ctx.hasSelection && !ctx.readonly,
        run: () => this.openAttachFlow(),
      });
      onCleanup(off);
    });

    destroyRef.onDestroy(() => this.closeOverlays());
  }

  private canAttach(): boolean {
    if (this.host.disabled() || this.host.readonly()) return false;
    const sel = this.host.selection();
    return sel.kind !== 'none' || !!sel.closestWithAttrs(ACTION_ATTRS);
  }

  private openAttachFlow(): void {
    // Implemented in Task 6.
  }

  private closeOverlays(): void {
    // Implemented in Tasks 6 & 8.
  }
}
```

Because Steps in Task 6/8 fill `openAttachFlow`/`closeOverlays`, leaving them as empty-body private methods here would violate "no empty method" lint only if flagged; add a single `void this.vcr;` reference is NOT allowed (unused-field). To keep `vcr` used and avoid ts6133 now, defer injecting `vcr` until Task 6 — remove the `vcr` field and its import in this task, re-add in Task 6. Keep the JSDoc-free private methods; a body of a single comment is disallowed, so give them a no-op body: `openAttachFlow()` → leave a `return;` is still empty-ish. Instead, implement a minimal real body now: have `openAttachFlow` call `this.host.saveSelection()` (a real, harmless action) and `closeOverlays` do nothing yet by iterating an empty overlay list introduced in Task 6. Simplest: introduce `private readonly overlays: (() => void)[] = [];` now, have `closeOverlays()` run and clear them, and `openAttachFlow()` call `this.host.saveSelection()`. This keeps every member used and bodies non-empty.

Apply that: remove `vcr` for now; add `private readonly overlays: (() => void)[] = [];`; `openAttachFlow()` body = `this.host.saveSelection();`; `closeOverlays()` body = `for (const off of this.overlays.splice(0)) off();`.

- [ ] **Step 6: Write the barrel**

```typescript
// index.ts
export * from './rich-text-actions.types';
export * from './rich-text-actions.serializer';
export * from './rich-text-actions.directive';
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run packages/components/ui/rich-text-editor/addons/actions`
Expected: PASS (serializer + directive smoke specs).

- [ ] **Step 8: Commit**

```bash
git add packages/components/ui/rich-text-editor/addons/actions/
git commit -m "feat(rich-text-actions): types, serializer, directive skeleton"
```

---

## Task 6: Attach dialog + tier-1 form + apply-to-DOM

**Files:**
- Create: `.../addons/actions/rich-text-actions-form.component.ts` / `.html`
- Create: `.../addons/actions/rich-text-actions-dialog.component.ts` / `.html`
- Modify: `.../addons/actions/rich-text-actions.directive.ts`
- Test: `rich-text-actions-form.component.spec.ts`, `rich-text-actions-dialog.component.spec.ts`, append to `rich-text-actions.directive.spec.ts`

**Interfaces:**
- Produces:
  - `RichTextActionsFormComponent` (selector `ui-rich-text-actions-form`) — inputs `fields: RichTextActionField[]`, `params: ActionParams`; outputs `paramsChange`, `validChange`; renders tier-1 fields with required gating.
  - `RichTextActionsDialogComponent` (selector `ui-rich-text-actions-dialog`) — imperatively created; inputs `definitions`, `context` (`mode`, `targetKind`, `selectionText`, occupied triggers, prefill); output `confirm: { def, trigger, params }` and `cancel`.
  - Directive gains real `openAttachFlow()` that: saves selection, resolves target kind, creates the dialog via `ViewContainerRef`, and on confirm applies to the DOM.
- Consumed by: Tasks 7 (tiers 2/3), 8 (edit mode reuse).

**Context:** Use package components only: `ui-dialog` family, `ui-command` (searchable picker), `ui-input`, `ui-select`, `ui-checkbox`, `ui-button`, `ui-label` — import through their barrels (`from '../../../command'` etc.). Overlay must be responsive (`max-w-[calc(100vw-2rem)] sm:max-w-md`) and RTL-aware. Density-driven padding, not hardcoded `p-6`.

- [ ] **Step 1: Write the failing tier-1 form tests**

```typescript
// rich-text-actions-form.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RichTextActionsFormComponent } from './rich-text-actions-form.component';

describe('RichTextActionsFormComponent', () => {
  it('emits invalid until a required field is filled, then valid', () => {
    const fixture = TestBed.createComponent(RichTextActionsFormComponent);
    const cmp = fixture.componentRef;
    cmp.setInput('fields', [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }]);
    cmp.setInput('params', {});
    let valid = true;
    fixture.componentInstance.validChange.subscribe((v: boolean) => (valid = v));
    fixture.detectChanges();
    expect(valid).toBe(false);
    const input = fixture.nativeElement.querySelector('input[data-field="dialogId"]') as HTMLInputElement;
    input.value = 'pricing';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(valid).toBe(true);
  });

  it('emits params changes with correct value types', () => {
    const fixture = TestBed.createComponent(RichTextActionsFormComponent);
    const cmp = fixture.componentRef;
    cmp.setInput('fields', [{ key: 'count', label: 'Count', type: 'number' }]);
    cmp.setInput('params', {});
    let latest: Record<string, unknown> = {};
    fixture.componentInstance.paramsChange.subscribe((p: Record<string, unknown>) => (latest = p));
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[data-field="count"]') as HTMLInputElement;
    input.value = '42';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(latest['count']).toBe(42);
  });

  it('shows a custom validate() error message', () => {
    const fixture = TestBed.createComponent(RichTextActionsFormComponent);
    const cmp = fixture.componentRef;
    cmp.setInput('fields', [{
      key: 'code', label: 'Code', type: 'text',
      validate: (v: unknown) => (String(v).length < 3 ? 'Too short' : null),
    }]);
    cmp.setInput('params', { code: 'ab' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Too short');
  });
});
```

Run: `npx vitest run .../rich-text-actions-form.component.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement the tier-1 form**

```typescript
// rich-text-actions-form.component.ts
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import type { ActionParams, RichTextActionField } from './rich-text-actions.types';

/** Renders declarative action fields (tier 1) and emits params + validity. */
@Component({
  selector: 'ui-rich-text-actions-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rich-text-actions-form.component.html',
  host: { class: 'block', '[attr.data-slot]': "'rich-text-actions-form'" },
})
export class RichTextActionsFormComponent {
  readonly class = input('');
  readonly fields = input<RichTextActionField[]>([]);
  readonly params = input<ActionParams>({});

  readonly paramsChange = output<ActionParams>();
  readonly validChange = output<boolean>();

  private readonly model = signal<ActionParams>({});

  readonly errors = computed<Record<string, string | null>>(() => {
    const p = this.model();
    const out: Record<string, string | null> = {};
    for (const f of this.fields()) out[f.key] = this.fieldError(f, p[f.key]);
    return out;
  });

  readonly isValid = computed(() => Object.values(this.errors()).every((e) => e === null));

  constructor() {
    effect(() => this.model.set({ ...this.params() }));
    effect(() => this.validChange.emit(this.isValid()));
  }

  private fieldError(field: RichTextActionField, value: unknown): string | null {
    const empty = value === undefined || value === '' || value === null;
    if (field.required && empty) return `${field.label} is required`;
    if (!empty && field.validate) return field.validate(value);
    return null;
  }

  onFieldInput(field: RichTextActionField, raw: string | boolean): void {
    const value = this.coerce(field, raw);
    const next = { ...this.model(), [field.key]: value } as ActionParams;
    this.model.set(next);
    this.paramsChange.emit(next);
  }

  private coerce(field: RichTextActionField, raw: string | boolean): string | number | boolean {
    if (field.type === 'checkbox') return Boolean(raw);
    if (field.type === 'number') return Number(raw);
    return String(raw);
  }
}
```

```html
<!-- rich-text-actions-form.component.html -->
<div class="space-y-3">
  @for (field of fields(); track field.key) {
    <div class="space-y-1">
      <label [for]="'rtaf-' + field.key" class="text-sm font-medium block">
        {{ field.label }}@if (field.required) {<span class="text-destructive"> *</span>}
      </label>

      @switch (field.type) {
        @case ('textarea') {
          <textarea
            [id]="'rtaf-' + field.key" [attr.data-field]="field.key"
            [value]="stringValue(field.key)" [placeholder]="field.placeholder ?? ''"
            (input)="onFieldInput(field, $any($event.target).value)"
            class="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          ></textarea>
        }
        @case ('checkbox') {
          <input type="checkbox" [id]="'rtaf-' + field.key" [attr.data-field]="field.key"
            [checked]="boolValue(field.key)"
            (change)="onFieldInput(field, $any($event.target).checked)" />
        }
        @case ('select') {
          <select [id]="'rtaf-' + field.key" [attr.data-field]="field.key"
            [value]="stringValue(field.key)"
            (change)="onFieldInput(field, $any($event.target).value)"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="" disabled>{{ field.placeholder ?? 'Select…' }}</option>
            @for (opt of field.options ?? []; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        }
        @default {
          <input [type]="field.type === 'number' ? 'number' : 'text'"
            [id]="'rtaf-' + field.key" [attr.data-field]="field.key"
            [value]="stringValue(field.key)" [placeholder]="field.placeholder ?? ''"
            (input)="onFieldInput(field, $any($event.target).value)"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
        }
      }

      @if (field.description) {<p class="text-xs text-muted-foreground">{{ field.description }}</p>}
      @if (errors()[field.key]; as err) {<p class="text-xs text-destructive">{{ err }}</p>}
    </div>
  }
</div>
```

Add the `stringValue`/`boolValue` helpers to the component:

```typescript
stringValue(key: string): string {
  const v = this.model()[key];
  return v === undefined || v === null ? '' : String(v);
}
boolValue(key: string): boolean {
  return Boolean(this.model()[key]);
}
```

Note: the spec's composition rule prefers `ui-input`/`ui-select`/`ui-checkbox`. If those components support a plain `[value]`/`(input)` or `value`+CVA cleanly, swap the raw elements for them; the raw elements are the fallback that keeps this task self-contained. Confirm against the components' public inputs and prefer them where they drop in without extra ceremony.

Run: `npx vitest run .../rich-text-actions-form.component.spec.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing dialog tests**

```typescript
// rich-text-actions-dialog.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RichTextActionsDialogComponent } from './rich-text-actions-dialog.component';
import type { RichTextActionDefinition } from './rich-text-actions.types';

const defs: RichTextActionDefinition[] = [
  { id: 'open-dialog', label: 'Open dialog', triggers: ['click'],
    fields: [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }] },
  { id: 'term', label: 'Term', triggers: ['hover'], targets: ['text'] },
];

function mount(overrides: Partial<{ targetKind: 'text' | 'image' }> = {}) {
  const fixture = TestBed.createComponent(RichTextActionsDialogComponent);
  const ref = fixture.componentRef;
  ref.setInput('definitions', defs);
  ref.setInput('context', {
    mode: 'create', targetKind: overrides.targetKind ?? 'text',
    selectionText: 'hello', occupiedTriggers: [], prefill: null,
  });
  fixture.detectChanges();
  return fixture;
}

describe('RichTextActionsDialogComponent', () => {
  it('hides actions whose targets exclude the current image target', () => {
    const fixture = mount({ targetKind: 'image' });
    expect(fixture.nativeElement.textContent).toContain('Open dialog');
    expect(fixture.nativeElement.textContent).not.toContain('Term');
  });

  it('disables confirm until required fields are valid, then emits confirm payload', () => {
    const fixture = mount();
    const inst = fixture.componentInstance;
    (inst as unknown as { pickAction: (id: string) => void }).pickAction('open-dialog');
    fixture.detectChanges();
    let payload: unknown = null;
    inst.confirm.subscribe((p: unknown) => (payload = p));
    const confirmBtn = fixture.nativeElement.querySelector('[data-testid="rta-confirm"]') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    inst.onParamsChange({ dialogId: 'pricing' });
    inst.onValidChange(true);
    fixture.detectChanges();
    expect(confirmBtn.disabled).toBe(false);
    confirmBtn.click();
    expect(payload).toEqual({
      def: expect.objectContaining({ id: 'open-dialog' }),
      trigger: 'click', params: { dialogId: 'pricing' },
    });
  });
});
```

Run and confirm FAIL (module not found).

- [ ] **Step 4: Implement the dialog**

```typescript
// rich-text-actions-dialog.component.ts
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  DialogComponent, DialogContentComponent, DialogHeaderComponent,
  DialogTitleComponent, DialogFooterComponent,
} from '../../../dialog';
import { ButtonComponent } from '../../../button';
import { RichTextActionsFormComponent } from './rich-text-actions-form.component';
import type {
  ActionParams, RichTextActionDefinition, RichTextActionTrigger,
} from './rich-text-actions.types';

export interface ActionsDialogContext {
  mode: 'create' | 'edit';
  targetKind: 'text' | 'image';
  selectionText: string;
  occupiedTriggers: RichTextActionTrigger[];
  prefill: { def: RichTextActionDefinition; trigger: RichTextActionTrigger; params: ActionParams } | null;
}

/** Attach/edit dialog: searchable action picker + generated tier-1 form. */
@Component({
  selector: 'ui-rich-text-actions-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DialogComponent, DialogContentComponent, DialogHeaderComponent,
    DialogTitleComponent, DialogFooterComponent, ButtonComponent, RichTextActionsFormComponent,
  ],
  templateUrl: './rich-text-actions-dialog.component.html',
  host: { '[attr.data-slot]': "'rich-text-actions-dialog'" },
})
export class RichTextActionsDialogComponent {
  readonly definitions = input<RichTextActionDefinition[]>([]);
  readonly context = input.required<ActionsDialogContext>();

  readonly confirm = output<{ def: RichTextActionDefinition; trigger: RichTextActionTrigger; params: ActionParams }>();
  readonly cancel = output<void>();

  readonly query = signal('');
  readonly selectedDef = signal<RichTextActionDefinition | null>(null);
  readonly selectedTrigger = signal<RichTextActionTrigger | null>(null);
  readonly currentParams = signal<ActionParams>({});
  readonly formValid = signal(false);

  readonly visibleDefs = computed(() => {
    const kind = this.context().targetKind;
    const q = this.query().toLowerCase();
    return this.definitions()
      .filter((d) => (d.targets ?? ['text', 'image']).includes(kind))
      .filter((d) => !q || d.label.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q));
  });

  readonly canConfirm = computed(() => {
    const def = this.selectedDef();
    if (!def) return false;
    if (!this.selectedTrigger()) return false;
    if (def.fields && def.fields.length > 0) return this.formValid();
    return true;
  });

  readonly occupiedByTrigger = computed(() => new Set(this.context().occupiedTriggers));

  constructor() {
    // Prefill (edit mode) is applied by pickAction when context carries it.
  }

  pickAction(id: string): void {
    const def = this.definitions().find((d) => d.id === id) ?? null;
    this.selectedDef.set(def);
    this.selectedTrigger.set(def && def.triggers.length === 1 ? def.triggers[0] : this.selectedTrigger());
    const prefill = this.context().prefill;
    this.currentParams.set(prefill && prefill.def.id === id ? { ...prefill.params } : {});
    this.formValid.set(!def?.fields || def.fields.length === 0);
  }

  selectTrigger(trigger: RichTextActionTrigger): void {
    this.selectedTrigger.set(trigger);
  }

  onParamsChange(params: ActionParams): void {
    this.currentParams.set(params);
  }
  onValidChange(valid: boolean): void {
    this.formValid.set(valid);
  }

  onConfirm(): void {
    const def = this.selectedDef();
    const trigger = this.selectedTrigger();
    if (!def || !trigger || !this.canConfirm()) return;
    this.confirm.emit({ def, trigger, params: this.currentParams() });
  }
}
```

```html
<!-- rich-text-actions-dialog.component.html -->
<ui-dialog [open]="true" (openChange)="!$event && cancel.emit()">
  <ui-dialog-content class="max-w-[calc(100vw-2rem)] sm:max-w-md">
    <ui-dialog-header>
      <ui-dialog-title>
        @if (context().mode === 'edit') { Edit action }
        @else if (context().targetKind === 'image') { Attach action to image }
        @else { Attach action to “{{ context().selectionText }}” }
      </ui-dialog-title>
    </ui-dialog-header>

    <div class="space-y-4">
      <input
        type="text" [value]="query()" placeholder="Search actions…"
        (input)="query.set($any($event.target).value)"
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />

      <div class="max-h-56 overflow-y-auto rounded-md border" role="listbox">
        @for (def of visibleDefs(); track def.id) {
          <button type="button" role="option" [attr.data-action-option]="def.id"
            [attr.aria-selected]="selectedDef()?.id === def.id"
            (click)="pickAction(def.id)"
            class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            [class.bg-accent]="selectedDef()?.id === def.id">
            <span>{{ def.label }}</span>
            <span class="text-xs text-muted-foreground">
              {{ def.triggers.join(' / ') }}
            </span>
          </button>
        }
      </div>

      @if (selectedDef(); as def) {
        @if (def.triggers.length > 1) {
          <div class="flex flex-wrap items-center gap-3">
            @for (t of def.triggers; track t) {
              <label class="flex items-center gap-1.5 text-sm">
                <input type="radio" name="rta-trigger" [checked]="selectedTrigger() === t"
                  (change)="selectTrigger(t)" />
                {{ t }}
                @if (occupiedByTrigger().has(t)) {
                  <span class="text-xs text-muted-foreground">(replaces existing)</span>
                }
              </label>
            }
          </div>
        }

        @if (def.fields && def.fields.length > 0) {
          <ui-rich-text-actions-form
            [fields]="def.fields" [params]="currentParams()"
            (paramsChange)="onParamsChange($event)" (validChange)="onValidChange($event)" />
        }
      }
    </div>

    <ui-dialog-footer>
      <ui-button variant="ghost" (click)="cancel.emit()">Cancel</ui-button>
      <ui-button data-testid="rta-confirm" [disabled]="!canConfirm()" (click)="onConfirm()">
        @if (occupiedByTrigger().has(selectedTrigger()!)) { Replace } @else { Attach }
      </ui-button>
    </ui-dialog-footer>
  </ui-dialog-content>
</ui-dialog>
```

Verify the `ui-dialog` inputs/outputs (`[open]`, `(openChange)`) against the dialog component's public API and adjust bindings if they differ. Run the dialog spec → PASS.

- [ ] **Step 5: Wire `openAttachFlow` + apply-to-DOM in the directive**

Re-add `private readonly vcr = inject(ViewContainerRef);`. Replace the placeholder `openAttachFlow`/`closeOverlays` with:

```typescript
private openAttachFlow(): void {
  this.host.saveSelection();
  const sel = this.host.selection();
  const existing = sel.closestWithAttrs(ACTION_ATTRS);
  const targetKind: 'text' | 'image' = sel.kind === 'image' ? 'image' : 'text';
  const occupied = existing ? readActions(existing).map((a) => a.trigger) : [];
  const ref = this.vcr.createComponent(RichTextActionsDialogComponent);
  ref.setInput('definitions', this.uiRteActions());
  ref.setInput('context', {
    mode: existing ? 'edit' : 'create', targetKind,
    selectionText: sel.text, occupiedTriggers: occupied, prefill: null,
  });
  const teardown = () => ref.destroy();
  this.overlays.push(teardown);
  ref.instance.cancel.subscribe(() => this.closeOverlay(teardown));
  ref.instance.confirm.subscribe((payload) => {
    this.applyAction(payload.def, payload.trigger, payload.params, targetKind, existing);
    this.closeOverlay(teardown);
  });
}

private closeOverlay(teardown: () => void): void {
  const i = this.overlays.indexOf(teardown);
  if (i !== -1) this.overlays.splice(i, 1);
  teardown();
}

private applyAction(
  def: RichTextActionDefinition, trigger: 'click' | 'hover',
  params: ActionParams, targetKind: 'text' | 'image', existing: HTMLElement | null,
): void {
  assertFlatParams(params);
  if (targetKind === 'image') {
    const img = this.host.selection().imageElement;
    if (img) this.host.mutateContent(() => writeAction(img, trigger, def.id, params));
  } else if (existing) {
    this.host.mutateContent(() => writeAction(existing, trigger, def.id, params));
  } else {
    this.host.wrapSelection(() => {
      const span = this.markdownDoc().createElement('span');
      writeAction(span, trigger, def.id, params);
      return span;
    });
  }
  this.actionAttached.emit({ actionId: def.id, trigger, params, targetKind });
}

private markdownDoc(): Document {
  return this.host.contentRoot.ownerDocument;
}
```

Add imports: `ViewContainerRef` (already), `readActions`, `writeAction`, `assertFlatParams` from the serializer; `RichTextActionsDialogComponent`; `ActionParams`, `RichTextActionDefinition` types. Note `wrapSelection` in Task 4 doesn't accept params to `writeAction` before insertion — building the span, writing the action, then wrapping is correct because `writeAction` runs on the detached span first. Confirm `wrapSelection`'s `build()` runs before `surroundContents`; it does.

- [ ] **Step 6: Append directive apply tests**

```typescript
// append to rich-text-actions.directive.spec.ts — drive attach end to end
it('attaches a click action to a text selection and emits actionAttached', async () => {
  const fixture = TestBed.createComponent(HostCmp);
  fixture.detectChanges();
  const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
  editor.innerHTML = '<p>hello world</p>';
  const node = editor.querySelector('p')!.firstChild!;
  const range = document.createRange();
  range.setStart(node, 0); range.setEnd(node, 5);
  const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);

  const slotBtn = fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]') as HTMLButtonElement;
  slotBtn.click();
  fixture.detectChanges();

  const option = document.querySelector('[data-action-option="open-dialog"]') as HTMLButtonElement;
  option.click();
  fixture.detectChanges();
  const dialogInput = document.querySelector('input[data-field="dialogId"]') as HTMLInputElement;
  dialogInput.value = 'pricing';
  dialogInput.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  (document.querySelector('[data-testid="rta-confirm"]') as HTMLButtonElement).click();
  fixture.detectChanges();

  expect(editor.querySelector('span[data-action-click="open-dialog"]')?.getAttribute('data-action-click-params'))
    .toBe('{"dialogId":"pricing"}');
});
```

Because the dialog is created in the directive's `ViewContainerRef`, its DOM mounts in the host fixture; if it renders in an overlay/portal, query `document` (as above). Adjust the selector root if the dialog uses a CDK-style portal.

Run: `npx vitest run packages/components/ui/rich-text-editor/addons/actions`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/components/ui/rich-text-editor/addons/actions/
git commit -m "feat(rich-text-actions): attach dialog, tier-1 form, apply-to-DOM"
```

---

## Task 7: Tier 2 (`formComponent`) + tier 3 (`resolveParams`)

**Files:**
- Modify: `.../rich-text-actions-dialog.component.ts` / `.html` (host a dynamic form component)
- Modify: `.../rich-text-actions.directive.ts` (tier precedence + external flow)
- Test: append to `rich-text-actions-dialog.component.spec.ts`, `rich-text-actions.directive.spec.ts`

**Interfaces:**
- Consumes: `RichTextActionParamsForm` contract (Task 5 types), `RichTextActionDefinition.formComponent`/`resolveParams`.
- Produces: precedence rule `resolveParams` > `formComponent` > `fields` > none, enforced in the directive; dialog renders `formComponent` via `ViewContainerRef` and gates confirm on its `valid()`.

- [ ] **Step 1: Write failing tests**

```typescript
// append to rich-text-actions-dialog.component.spec.ts
import { Component, signal, computed } from '@angular/core';
import type { RichTextActionParamsForm, RichTextActionParamsContext } from './rich-text-actions.types';

@Component({ standalone: true, template: `<input data-testid="custom" (input)="onIn($any($event.target).value)" />` })
class CustomForm implements RichTextActionParamsForm {
  context!: RichTextActionParamsContext;
  readonly params = signal<Record<string, string | number | boolean>>({});
  readonly valid = computed(() => Object.keys(this.params()).length > 0);
  onIn(v: string) { this.params.set({ entityId: v }); }
}

it('renders a tier-2 formComponent and gates confirm on its valid signal', () => {
  const fixture = TestBed.createComponent(RichTextActionsDialogComponent);
  const ref = fixture.componentRef;
  ref.setInput('definitions', [{ id: 'x', label: 'X', triggers: ['click'], formComponent: CustomForm }]);
  ref.setInput('context', { mode: 'create', targetKind: 'text', selectionText: 's', occupiedTriggers: [], prefill: null });
  fixture.detectChanges();
  (fixture.componentInstance as unknown as { pickAction(id: string): void }).pickAction('x');
  fixture.detectChanges();
  const confirmBtn = fixture.nativeElement.querySelector('[data-testid="rta-confirm"]') as HTMLButtonElement;
  expect(confirmBtn.disabled).toBe(true);
  const custom = fixture.nativeElement.querySelector('[data-testid="custom"]') as HTMLInputElement;
  custom.value = 'e-1'; custom.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  expect(confirmBtn.disabled).toBe(false);
});
```

```typescript
// append to rich-text-actions.directive.spec.ts — tier 3 + precedence
it('tier 3 resolveParams runs without a dialog and attaches resolved params', async () => {
  const fixture = TestBed.createComponent(HostCmp);
  fixture.componentInstance.defs = [{
    id: 'campaign', label: 'Campaign', triggers: ['click'],
    resolveParams: async () => ({ campaignId: 'c-42' }),
  }];
  fixture.detectChanges();
  const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
  editor.innerHTML = '<p>go</p>';
  const node = editor.querySelector('p')!.firstChild!;
  const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 2);
  const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
  (fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]') as HTMLButtonElement).click();
  // resolveParams path: pick happens via the picker; simulate selecting the only action.
  fixture.detectChanges();
  const option = document.querySelector('[data-action-option="campaign"]') as HTMLButtonElement;
  option.click();
  await Promise.resolve(); await Promise.resolve();
  fixture.detectChanges();
  expect(editor.querySelector('span[data-action-click="campaign"]')?.getAttribute('data-action-click-params'))
    .toBe('{"campaignId":"c-42"}');
});

it('rejects non-flat params from a tier and does not attach', async () => {
  // A resolveParams returning nested object → assertFlatParams throws → console.error, no span.
  const errors: unknown[] = [];
  const origErr = console.error;
  console.error = (...a: unknown[]) => errors.push(a);
  try {
    const fixture = TestBed.createComponent(HostCmp);
    fixture.componentInstance.defs = [{
      id: 'bad', label: 'Bad', triggers: ['click'],
      resolveParams: async () => ({ nested: { x: 1 } } as unknown as Record<string, string | number | boolean>),
    }];
    fixture.detectChanges();
    const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
    editor.innerHTML = '<p>go</p>';
    const node = editor.querySelector('p')!.firstChild!;
    const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 2);
    const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
    (fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (document.querySelector('[data-action-option="bad"]') as HTMLButtonElement).click();
    await Promise.resolve(); await Promise.resolve();
    fixture.detectChanges();
    expect(editor.querySelector('span[data-action-click="bad"]')).toBeFalsy();
    expect(errors.length).toBeGreaterThan(0);
  } finally {
    console.error = origErr;
  }
});
```

Run → FAIL.

- [ ] **Step 2: Host a dynamic form in the dialog**

In `rich-text-actions-dialog.component.ts`, add a `viewChild` anchor and render `formComponent` when the picked def has one. Add:

```typescript
import { viewChild, ViewContainerRef, effect, type ComponentRef } from '@angular/core';
import type { RichTextActionParamsForm } from './rich-text-actions.types';
// ...
readonly formHost = viewChild('formHost', { read: ViewContainerRef });
private customForm?: ComponentRef<RichTextActionParamsForm>;
```

In `pickAction`, after setting `selectedDef`, render the custom form if present:

```typescript
private renderCustomForm(def: RichTextActionDefinition): void {
  this.customForm?.destroy();
  this.customForm = undefined;
  const anchor = this.formHost();
  if (!def.formComponent || !anchor) return;
  anchor.clear();
  const ref = anchor.createComponent(def.formComponent);
  ref.instance.context = {
    mode: this.context().mode, trigger: this.selectedTrigger() ?? def.triggers[0],
    currentParams: this.currentParams(), selectionText: this.context().selectionText,
    targetKind: this.context().targetKind, targetElement: null,
  };
  ref.instance.params.set({ ...this.currentParams() });
  this.customForm = ref;
  effect(() => {
    this.currentParams.set(ref.instance.params());
    this.formValid.set(ref.instance.valid());
  }, { injector: this.injector });
}
```

Inject `private readonly injector = inject(Injector);`. Call `this.renderCustomForm(def)` at the end of `pickAction`. Update `canConfirm` so that a def with a `formComponent` gates on `formValid()` (add `if (def.formComponent) return this.formValid();` before the fields check). Add the anchor to the template inside the picked-def block, replacing/next to the tier-1 form:

```html
@if (def.formComponent) {
  <ng-container #formHost />
} @else if (def.fields && def.fields.length > 0) {
  <ui-rich-text-actions-form ... />
}
```

Destroy `customForm` in a component `ngOnDestroy`.

- [ ] **Step 3: Tier precedence + external flow in the directive**

Refactor `openAttachFlow` to branch on the picked action's tier. Because the picker lives in the dialog, move tier-3 handling to run when a def with `resolveParams` is chosen. Simplest robust approach: the dialog always shows the picker; when an action is picked, it emits a `pick` event; the directive decides the tier:

Add to the dialog: `readonly pick = output<RichTextActionDefinition>();` and emit it at the end of `pickAction`. In the directive, subscribe:

```typescript
ref.instance.pick.subscribe((def) => this.onPick(def, ref, teardown, targetKind, existing));
```

```typescript
private onPick(
  def: RichTextActionDefinition, ref: ComponentRef<RichTextActionsDialogComponent>,
  teardown: () => void, targetKind: 'text' | 'image', existing: HTMLElement | null,
): void {
  if (!def.resolveParams) return; // tiers 1 & 2 stay in the dialog
  const trigger = def.triggers[0];
  const ctx: RichTextActionParamsContext = {
    mode: existing ? 'edit' : 'create', trigger,
    currentParams: {}, selectionText: this.host.selection().text,
    targetKind, targetElement: existing,
  };
  ref.instance.setBusy(true);
  def.resolveParams(ctx)
    .then((params) => {
      this.closeOverlay(teardown);
      if (params === null) return;
      try {
        assertFlatParams(params);
      } catch (err) {
        console.error('[rich-text-actions] resolveParams returned non-flat params:', err);
        return;
      }
      this.applyResolved(def, trigger, params, targetKind, existing);
    })
    .catch((err) => {
      this.closeOverlay(teardown);
      console.error('[rich-text-actions] resolveParams rejected:', err);
    });
}

private applyResolved(
  def: RichTextActionDefinition, trigger: 'click' | 'hover',
  params: ActionParams, targetKind: 'text' | 'image', existing: HTMLElement | null,
): void {
  this.applyAction(def, trigger, params, targetKind, existing);
}
```

For tier-2 non-flat rejection: wrap the `writeAction` calls inside `applyAction` in a try/catch that logs and keeps the dialog open. Since `applyAction` runs on confirm, guard there:

```typescript
try {
  assertFlatParams(params);
} catch (err) {
  console.error('[rich-text-actions] form returned non-flat params:', err);
  return; // caller keeps the dialog open (do not closeOverlay before applyAction on the confirm path)
}
```

Restructure the confirm subscription so `closeOverlay` runs only after a successful `applyAction` (move `closeOverlay` inside a success branch, or have `applyAction` return a boolean). Make `applyAction` return `boolean` (`true` on success) and only `closeOverlay` when it returns true. Add `setBusy(v: boolean)` to the dialog (a `busy` signal that overlays a spinner on the picker and disables it).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run packages/components/ui/rich-text-editor/addons/actions`
Expected: PASS (tiers 1–3 + precedence + rejection).

- [ ] **Step 5: Commit**

```bash
git add packages/components/ui/rich-text-editor/addons/actions/
git commit -m "feat(rich-text-actions): tier-2 formComponent + tier-3 resolveParams + precedence"
```

---

## Task 8: Edit popover, in-editor visualization, readonly gating

**Files:**
- Create: `.../rich-text-actions-popover.component.ts` / `.html`
- Modify: `.../rich-text-actions.directive.ts` (caret-driven popover, remove/unwrap, visualization stylesheet, readonly gating)
- Test: `rich-text-actions-popover.component.spec.ts`, append to directive spec

**Interfaces:**
- Produces: `RichTextActionsPopoverComponent` (selector `ui-rich-text-actions-popover`) — input `actions: { trigger, id, label, available }[]`; outputs `edit: trigger`, `remove: trigger`, `add`.
- Directive: shows the popover when the caret enters an actioned element; edit reopens the dialog in edit mode; remove drops a trigger and unwraps a bare span; unknown ids render as remove-only.

- [ ] **Step 1: Write failing popover tests**

```typescript
// rich-text-actions-popover.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RichTextActionsPopoverComponent } from './rich-text-actions-popover.component';

describe('RichTextActionsPopoverComponent', () => {
  it('lists actions and emits edit/remove per row', () => {
    const fixture = TestBed.createComponent(RichTextActionsPopoverComponent);
    fixture.componentRef.setInput('actions', [
      { trigger: 'click', id: 'open-dialog', label: 'Open dialog', available: true },
      { trigger: 'hover', id: 'ghost', label: 'ghost', available: false },
    ]);
    fixture.detectChanges();
    const edits: string[] = []; const removes: string[] = [];
    fixture.componentInstance.edit.subscribe((t: string) => edits.push(t));
    fixture.componentInstance.remove.subscribe((t: string) => removes.push(t));
    const editBtns = fixture.nativeElement.querySelectorAll('[data-testid="rta-edit"]');
    expect(editBtns.length).toBe(1); // unavailable row has no edit
    (editBtns[0] as HTMLButtonElement).click();
    expect(edits).toEqual(['click']);
    const removeBtns = fixture.nativeElement.querySelectorAll('[data-testid="rta-remove"]');
    expect(removeBtns.length).toBe(2);
    (removeBtns[1] as HTMLButtonElement).click();
    expect(removes).toEqual(['hover']);
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement the popover**

```typescript
// rich-text-actions-popover.component.ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../button';

export interface PopoverActionRow {
  trigger: 'click' | 'hover';
  id: string;
  label: string;
  available: boolean;
}

/** Compact editor-side popover listing an element's actions with edit/remove/add. */
@Component({
  selector: 'ui-rich-text-actions-popover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  templateUrl: './rich-text-actions-popover.component.html',
  host: { '[attr.data-slot]': "'rich-text-actions-popover'" },
})
export class RichTextActionsPopoverComponent {
  readonly actions = input<PopoverActionRow[]>([]);
  readonly canAdd = input(true);
  readonly edit = output<'click' | 'hover'>();
  readonly remove = output<'click' | 'hover'>();
  readonly add = output<void>();
}
```

```html
<!-- rich-text-actions-popover.component.html -->
<div class="min-w-56 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 shadow-md">
  @for (row of actions(); track row.trigger) {
    <div class="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm">
      <span class="truncate">
        {{ row.label }} · {{ row.trigger }}
        @if (!row.available) { <span class="text-xs text-muted-foreground">(unavailable)</span> }
      </span>
      <span class="flex items-center gap-1">
        @if (row.available) {
          <button type="button" data-testid="rta-edit" class="text-xs underline"
            (click)="edit.emit(row.trigger)">Edit</button>
        }
        <button type="button" data-testid="rta-remove" class="text-xs text-destructive underline"
          (click)="remove.emit(row.trigger)">Remove</button>
      </span>
    </div>
  }
  @if (canAdd()) {
    <button type="button" class="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
      (click)="add.emit()">+ Add action</button>
  }
</div>
```

Run popover spec → PASS.

- [ ] **Step 3: Caret-driven popover + remove/unwrap + visualization + readonly in the directive**

Add an effect watching selection; when the caret is inside an actioned element and the editor isn't readonly, create the popover anchored to that element; else close it. Add remove logic:

```typescript
private removeTrigger(el: HTMLElement, trigger: 'click' | 'hover', targetKind: 'text' | 'image'): void {
  const removedId = el.getAttribute(`data-action-${trigger}`) ?? '';
  this.host.mutateContent(() => {
    removeAction(el, trigger);
    const stillActioned = ACTION_ATTRS.some((a) => el.hasAttribute(a));
    const bareSpan = el.tagName === 'SPAN' && el.attributes.length === 0;
    if (!stillActioned && bareSpan) {
      const parent = el.parentNode;
      while (el.firstChild) parent?.insertBefore(el.firstChild, el);
      parent?.removeChild(el);
    }
  });
  this.actionRemoved.emit({ actionId: removedId, trigger, targetKind });
}
```

Build popover rows from `readActions(el)`, marking `available` by whether the id exists in `uiRteActions()`; `label` falls back to the id for unknown actions. For the in-editor visualization, inject a scoped `<style>` once into the editor content root's owner document head with a data-key so it's added once and removed on destroy, targeting only elements inside the editor:

```typescript
private injectVisualizationStyles(): void {
  const doc = this.host.contentRoot.ownerDocument;
  if (doc.querySelector('style[data-rte-actions-style]')) return;
  const style = doc.createElement('style');
  style.setAttribute('data-rte-actions-style', '');
  style.textContent = `
    ui-rich-text-editor [data-action-click],
    ui-rich-text-editor [data-action-hover] {
      text-decoration: underline dotted; text-underline-offset: 3px;
      background: color-mix(in srgb, currentColor 6%, transparent);
    }
    ui-rich-text-editor img[data-action-click],
    ui-rich-text-editor img[data-action-hover] { outline: 2px dashed currentColor; outline-offset: 2px; }
  `;
  doc.head.appendChild(style);
  this.overlays.push(() => style.remove());
}
```

Call `injectVisualizationStyles()` from an effect guarded by non-empty defs. Because this is inert styling scoped by the `ui-rich-text-editor` selector and injected via TS (not a component stylesheet), it doesn't violate `ViewEncapsulation.None` rules — it styles only inside the editor and is torn down. Gate all entry points on `!this.host.readonly() && !this.host.disabled()` (the slot's `isEnabled` and the slash command's `when` already do; ensure the popover effect also checks).

- [ ] **Step 4: Append directive tests (edit/remove/unknown/readonly)**

```typescript
it('shows the edit popover when the caret enters an actioned span and removes a trigger', () => {
  const fixture = TestBed.createComponent(HostCmp);
  fixture.detectChanges();
  const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
  editor.innerHTML = '<p><span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"x"}\'>t</span></p>';
  const span = editor.querySelector('span')!;
  const range = document.createRange(); range.selectNodeContents(span.firstChild!);
  const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
  fixture.detectChanges();
  const removeBtn = document.querySelector('[data-testid="rta-remove"]') as HTMLButtonElement;
  expect(removeBtn).toBeTruthy();
  removeBtn.click();
  fixture.detectChanges();
  expect(editor.querySelector('span[data-action-click]')).toBeFalsy();
  expect(editor.querySelector('p')!.textContent).toBe('t'); // span unwrapped
});

it('renders unknown action ids as remove-only', () => {
  const fixture = TestBed.createComponent(HostCmp);
  fixture.detectChanges();
  const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
  editor.innerHTML = '<p><span data-action-click="ghost-id">t</span></p>';
  const span = editor.querySelector('span')!;
  const range = document.createRange(); range.selectNodeContents(span.firstChild!);
  const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
  fixture.detectChanges();
  expect(document.querySelector('[data-testid="rta-edit"]')).toBeFalsy();
  expect(document.querySelector('[data-testid="rta-remove"]')).toBeTruthy();
});

it('hides entry points when the editor is readonly', () => {
  const fixture = TestBed.createComponent(HostCmp);
  const editorCmp = fixture.debugElement.query((d) => d.name === 'ui-rich-text-editor');
  editorCmp.componentInstance.readonly?.set?.(true); // if input is a signal input, set via componentRef
  fixture.componentRef.setInput?.('readonly', true);
  fixture.detectChanges();
  const slot = fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]') as HTMLButtonElement | null;
  expect(!slot || slot.disabled).toBe(true);
});
```

Adjust the readonly-setting mechanism to the editor's real `readonly` input (set it on the `HostCmp` template with `[readonly]="true"` and a bound field is cleaner — prefer editing `HostCmp` to accept a `readonly` field and bind it).

Run: `npx vitest run packages/components/ui/rich-text-editor/addons/actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/components/ui/rich-text-editor/addons/actions/
git commit -m "feat(rich-text-actions): edit popover, remove/unwrap, in-editor visualization, readonly gating"
```

---

## Task 9: Framework-free runtime `bindRichTextActions`

**Files:**
- Create: `.../addons/actions/actions-runtime.ts`
- Test: `.../addons/actions/actions-runtime.spec.ts`

**Interfaces:**
- Produces: `RichTextActionEvent`, `RichTextActionHandler`, `BindRichTextActionsOptions`, `bindRichTextActions(container, options): () => void`. No `@angular/*` imports.
- Consumed by: Task 10 (directive) and Task 11 (presets).

**Context:** Single delegated listener set on the container. Parse params via the serializer's `readActions` (pure, Angular-free) or an inline parse to keep the module Angular-free — import from `./rich-text-actions.serializer` (which imports only from `./rich-text-actions.types`, both Angular-free at runtime; the `types.ts` `import type` lines are erased at compile time, so the runtime graph has no Angular). Add a spec asserting no `@angular` string in the built module graph.

- [ ] **Step 1: Write failing tests**

```typescript
// actions-runtime.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { bindRichTextActions, type RichTextActionEvent } from './actions-runtime';

function container(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe('bindRichTextActions', () => {
  it('fires the click handler with id, params, element', () => {
    const el = container('<span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"p"}\'>t</span>');
    const seen: RichTextActionEvent[] = [];
    const off = bindRichTextActions(el, { handlers: { 'open-dialog': (e) => seen.push(e) } });
    (el.querySelector('span') as HTMLElement).click();
    expect(seen[0].actionId).toBe('open-dialog');
    expect(seen[0].params).toEqual({ dialogId: 'p' });
    expect(seen[0].trigger).toBe('click');
    off(); el.remove();
  });

  it('fires innermost only for nested action spans', () => {
    const el = container('<span data-action-click="outer"><span data-action-click="inner">t</span></span>');
    const ids: string[] = [];
    const off = bindRichTextActions(el, { handlers: { '*': (e) => ids.push(e.actionId) } });
    (el.querySelector('span span') as HTMLElement).click();
    expect(ids).toEqual(['inner']);
    off(); el.remove();
  });

  it('delivers hover start/end pairs', () => {
    const el = container('<span data-action-hover="term">t</span>');
    const phases: string[] = [];
    const off = bindRichTextActions(el, { handlers: { term: (e) => phases.push(e.phase) } });
    const span = el.querySelector('span') as HTMLElement;
    span.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: el }));
    span.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: el }));
    expect(phases).toEqual(['start', 'end']);
    off(); el.remove();
  });

  it('fires specific handler before catch-all', () => {
    const el = container('<span data-action-click="a">t</span>');
    const order: string[] = [];
    const off = bindRichTextActions(el, {
      handlers: { a: () => order.push('specific'), '*': () => order.push('catchall') },
    });
    (el.querySelector('span') as HTMLElement).click();
    expect(order).toEqual(['specific', 'catchall']);
    off(); el.remove();
  });

  it('gives handler {} for malformed params', () => {
    const el = container('<span data-action-click="a" data-action-click-params="{bad">t</span>');
    let params: unknown = null;
    const off = bindRichTextActions(el, { handlers: { a: (e) => (params = e.params) } });
    (el.querySelector('span') as HTMLElement).click();
    expect(params).toEqual({});
    off(); el.remove();
  });

  it('applies a11y affordances and reverts them on unbind', () => {
    const el = container('<span data-action-click="a">t</span>');
    const off = bindRichTextActions(el, { handlers: { a: () => {} } });
    const span = el.querySelector('span') as HTMLElement;
    expect(span.getAttribute('tabindex')).toBe('0');
    expect(span.getAttribute('role')).toBe('button');
    expect(span.classList.contains('rte-action-click')).toBe(true);
    off();
    expect(span.hasAttribute('tabindex')).toBe(false);
    expect(span.hasAttribute('role')).toBe(false);
    expect(span.classList.contains('rte-action-click')).toBe(false);
    el.remove();
  });

  it('stops delivering after unbind', () => {
    const el = container('<span data-action-click="a">t</span>');
    const fn = vi.fn();
    const off = bindRichTextActions(el, { handlers: { a: fn } });
    off();
    (el.querySelector('span') as HTMLElement).click();
    expect(fn).not.toHaveBeenCalled();
    el.remove();
  });

  it('adds no classes when decorateClass is null', () => {
    const el = container('<span data-action-click="a">t</span>');
    const off = bindRichTextActions(el, { handlers: { a: () => {} }, decorateClass: null });
    expect(el.querySelector('span')!.className).toBe('');
    off(); el.remove();
  });

  it('Enter activates a click action for keyboard users', () => {
    const el = container('<span data-action-click="a">t</span>');
    const fn = vi.fn();
    const off = bindRichTextActions(el, { handlers: { a: fn } });
    const span = el.querySelector('span') as HTMLElement;
    span.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
    off(); el.remove();
  });
});

describe('module purity', () => {
  it('the runtime source imports no @angular package', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./actions-runtime.ts', import.meta.url), 'utf8'));
    expect(src).not.toMatch(/from '@angular/);
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement the runtime**

```typescript
// actions-runtime.ts
import { readActions } from './rich-text-actions.serializer';
import type { ActionParams, RichTextActionTrigger } from './rich-text-actions.types';

export interface RichTextActionEvent {
  actionId: string;
  trigger: RichTextActionTrigger;
  params: ActionParams;
  element: HTMLElement;
  domEvent: Event;
  phase: 'start' | 'end';
}

export type RichTextActionHandler = (event: RichTextActionEvent) => void;

export interface BindRichTextActionsOptions {
  handlers: Record<string, RichTextActionHandler>;
  touchHoverBehavior?: 'tap-to-hover' | 'off';
  a11yAffordances?: boolean;
  decorateClass?: string | null;
}

const CLICK_ATTR = 'data-action-click';
const HOVER_ATTR = 'data-action-hover';

/** Bind delegated click/hover action listeners to a container. Returns unbind. */
export function bindRichTextActions(
  container: HTMLElement, options: BindRichTextActionsOptions,
): () => void {
  const a11y = options.a11yAffordances ?? true;
  const decorateClass = options.decorateClass === undefined ? 'rte-action' : options.decorateClass;
  const decorated: HTMLElement[] = [];

  decorateExisting(container, { a11y, decorateClass, decorated });

  const onClick = (e: Event) => dispatchClick(e, container, options);
  const onKeydown = (e: Event) => handleKeydown(e as KeyboardEvent, container, options);
  const onOver = (e: Event) => dispatchHover(e as MouseEvent, container, options, 'start');
  const onOut = (e: Event) => dispatchHover(e as MouseEvent, container, options, 'end');
  const onFocusIn = (e: Event) => dispatchFocusHover(e, container, options, 'start');
  const onFocusOut = (e: Event) => dispatchFocusHover(e, container, options, 'end');

  container.addEventListener('click', onClick);
  container.addEventListener('keydown', onKeydown);
  container.addEventListener('mouseover', onOver);
  container.addEventListener('mouseout', onOut);
  container.addEventListener('focusin', onFocusIn);
  container.addEventListener('focusout', onFocusOut);

  return () => {
    container.removeEventListener('click', onClick);
    container.removeEventListener('keydown', onKeydown);
    container.removeEventListener('mouseover', onOver);
    container.removeEventListener('mouseout', onOut);
    container.removeEventListener('focusin', onFocusIn);
    container.removeEventListener('focusout', onFocusOut);
    for (const el of decorated) revertDecoration(el, decorateClass);
  };
}

function decorateExisting(
  container: HTMLElement,
  ctx: { a11y: boolean; decorateClass: string | null; decorated: HTMLElement[] },
): void {
  const selector = `[${CLICK_ATTR}],[${HOVER_ATTR}]`;
  for (const el of Array.from(container.querySelectorAll<HTMLElement>(selector))) {
    if (ctx.decorateClass) {
      el.classList.add(ctx.decorateClass);
      if (el.hasAttribute(CLICK_ATTR)) el.classList.add(`${ctx.decorateClass}-click`);
      if (el.hasAttribute(HOVER_ATTR)) el.classList.add(`${ctx.decorateClass}-hover`);
    }
    if (ctx.a11y) {
      el.setAttribute('tabindex', '0');
      if (el.hasAttribute(CLICK_ATTR)) el.setAttribute('role', 'button');
    }
    ctx.decorated.push(el);
  }
}

function revertDecoration(el: HTMLElement, decorateClass: string | null): void {
  if (decorateClass) {
    el.classList.remove(decorateClass, `${decorateClass}-click`, `${decorateClass}-hover`);
    if (el.className === '') el.removeAttribute('class');
  }
  el.removeAttribute('tabindex');
  el.removeAttribute('role');
}

function actionedAncestor(target: EventTarget | null, container: HTMLElement, attr: string): HTMLElement | null {
  let el = target instanceof HTMLElement ? target : null;
  while (el && container.contains(el)) {
    if (el.hasAttribute(attr)) return el;
    el = el.parentElement;
  }
  return null;
}

function paramsFor(el: HTMLElement, trigger: RichTextActionTrigger): ActionParams {
  return readActions(el).find((a) => a.trigger === trigger)?.params ?? {};
}

function deliver(
  options: BindRichTextActionsOptions, event: RichTextActionEvent,
): void {
  const specific = options.handlers[event.actionId];
  if (specific) specific(event);
  const catchAll = options.handlers['*'];
  if (catchAll) catchAll(event);
}

function dispatchClick(e: Event, container: HTMLElement, options: BindRichTextActionsOptions): void {
  const el = actionedAncestor(e.target, container, CLICK_ATTR);
  if (!el) return;
  const id = el.getAttribute(CLICK_ATTR);
  if (!id) return;
  deliver(options, { actionId: id, trigger: 'click', params: paramsFor(el, 'click'), element: el, domEvent: e, phase: 'start' });
}

function handleKeydown(e: KeyboardEvent, container: HTMLElement, options: BindRichTextActionsOptions): void {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = actionedAncestor(e.target, container, CLICK_ATTR);
  if (!el) return;
  const id = el.getAttribute(CLICK_ATTR);
  if (!id) return;
  e.preventDefault();
  deliver(options, { actionId: id, trigger: 'click', params: paramsFor(el, 'click'), element: el, domEvent: e, phase: 'start' });
}

function dispatchHover(
  e: MouseEvent, container: HTMLElement, options: BindRichTextActionsOptions, phase: 'start' | 'end',
): void {
  const el = actionedAncestor(e.target, container, HOVER_ATTR);
  if (!el) return;
  const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
  if (related && el.contains(related)) return;
  const id = el.getAttribute(HOVER_ATTR);
  if (!id) return;
  deliver(options, { actionId: id, trigger: 'hover', params: paramsFor(el, 'hover'), element: el, domEvent: e, phase });
}

function dispatchFocusHover(
  e: Event, container: HTMLElement, options: BindRichTextActionsOptions, phase: 'start' | 'end',
): void {
  const el = actionedAncestor(e.target, container, HOVER_ATTR);
  if (!el) return;
  const id = el.getAttribute(HOVER_ATTR);
  if (!id) return;
  deliver(options, { actionId: id, trigger: 'hover', params: paramsFor(el, 'hover'), element: el, domEvent: e, phase });
}
```

Note the touch tap-to-hover path (test 47 in spec) is added here as a `touchend` listener; add it and a test. Given complexity budget (≤15), keep each `dispatch*` helper flat as above. Add `touchend` handling in a dedicated `handleTouch` helper mirroring `dispatchHover`/`dispatchClick` with the first-tap-suppresses-click state held in a `WeakSet`. Add the corresponding test from spec item 47.

- [ ] **Step 3: Run to verify pass**

Run: `npx vitest run packages/components/ui/rich-text-editor/addons/actions/actions-runtime.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/components/ui/rich-text-editor/addons/actions/actions-runtime.ts packages/components/ui/rich-text-editor/addons/actions/actions-runtime.spec.ts
git commit -m "feat(rich-text-actions): framework-free bindRichTextActions runtime"
```

---

## Task 10: Render-side directive `[uiRichTextActions]`

**Files:**
- Create: `.../addons/actions/rich-text-actions-bind.directive.ts`
- Modify: `.../addons/actions/index.ts` (export it)
- Test: `.../addons/actions/rich-text-actions-bind.directive.spec.ts`

**Interfaces:**
- Produces: `RichTextActionsBindDirective` selector `[uiRichTextActions]`, input `uiRichTextActions: Record<string, RichTextActionHandler>`, optional inputs `touchHoverBehavior`, `a11yAffordances`, `decorateClass`. Re-binds on input change and on host content mutation.

- [ ] **Step 1: Write failing tests**

```typescript
// rich-text-actions-bind.directive.spec.ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RichTextActionsBindDirective } from './rich-text-actions-bind.directive';
import type { RichTextActionEvent } from './actions-runtime';

@Component({
  standalone: true,
  imports: [RichTextActionsBindDirective],
  template: `<article [innerHTML]="html()" [uiRichTextActions]="handlers"></article>`,
})
class HostCmp {
  readonly html = signal('<span data-action-click="a">t</span>');
  events: RichTextActionEvent[] = [];
  handlers = { a: (e: RichTextActionEvent) => this.events.push(e) };
}

describe('RichTextActionsBindDirective', () => {
  it('delivers events for initial content and cleans up on destroy', () => {
    const fixture = TestBed.createComponent(HostCmp);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('span') as HTMLElement).click();
    expect(fixture.componentInstance.events.length).toBe(1);
    fixture.destroy();
  });

  it('re-binds after an [innerHTML] swap so new elements deliver events', async () => {
    const fixture = TestBed.createComponent(HostCmp);
    fixture.detectChanges();
    fixture.componentInstance.html.set('<span data-action-click="a">new</span>');
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0)); // MutationObserver is async
    (fixture.nativeElement.querySelector('span') as HTMLElement).click();
    expect(fixture.componentInstance.events.length).toBe(1);
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement the directive**

```typescript
// rich-text-actions-bind.directive.ts
import { Directive, ElementRef, DestroyRef, effect, inject, input } from '@angular/core';
import {
  bindRichTextActions, type BindRichTextActionsOptions, type RichTextActionHandler,
} from './actions-runtime';

/**
 * Binds `bindRichTextActions` to a host element and keeps it re-bound across
 * `[innerHTML]` swaps. Delivers typed action events to the handler map.
 */
@Directive({ selector: '[uiRichTextActions]', standalone: true })
export class RichTextActionsBindDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly uiRichTextActions = input<Record<string, RichTextActionHandler>>({});
  readonly touchHoverBehavior = input<'tap-to-hover' | 'off'>('tap-to-hover');
  readonly a11yAffordances = input(true);
  readonly decorateClass = input<string | null>('rte-action');

  private unbind: (() => void) | null = null;
  private observer: MutationObserver | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const options: BindRichTextActionsOptions = {
        handlers: this.uiRichTextActions(),
        touchHoverBehavior: this.touchHoverBehavior(),
        a11yAffordances: this.a11yAffordances(),
        decorateClass: this.decorateClass(),
      };
      this.rebind(options);
      this.observeMutations(options);
    });

    destroyRef.onDestroy(() => {
      this.unbind?.();
      this.observer?.disconnect();
    });
  }

  private rebind(options: BindRichTextActionsOptions): void {
    this.unbind?.();
    this.unbind = bindRichTextActions(this.el.nativeElement, options);
  }

  private observeMutations(options: BindRichTextActionsOptions): void {
    if (this.observer) return;
    this.observer = new MutationObserver(() => this.rebind(options));
    this.observer.observe(this.el.nativeElement, { childList: true, subtree: true });
  }
}
```

Note: the observer captures the first `options`; because the effect re-runs on input change and `rebind` uses fresh options each effect run, keep the observer callback reading the latest options. Refactor to store `private latestOptions` set in the effect and have the observer call `this.rebind(this.latestOptions)`. Apply that adjustment (store `latestOptions`, guard against re-entrant mutation loops by disconnecting during rebind if the rebind mutates attributes — it does add classes; to avoid an infinite loop, disconnect before `rebind` and reconnect after, or observe only `childList` not `attributes`, which the config above already does — attribute changes from decoration won't trigger `childList`). Keep `childList: true, subtree: true` and it's safe.

- [ ] **Step 3: Export from the barrel**

Add to `index.ts`:
```typescript
export * from './actions-runtime';
export * from './rich-text-actions-bind.directive';
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run packages/components/ui/rich-text-editor/addons/actions/rich-text-actions-bind.directive.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/components/ui/rich-text-editor/addons/actions/rich-text-actions-bind.directive.ts packages/components/ui/rich-text-editor/addons/actions/index.ts packages/components/ui/rich-text-editor/addons/actions/rich-text-actions-bind.directive.spec.ts
git commit -m "feat(rich-text-actions): [uiRichTextActions] render-side directive"
```

---

## Task 11: Optional presets (hover card + dialog)

**Files:**
- Create: `.../addons/actions/presets/preset-overlay.utils.ts`
- Create: `.../addons/actions/presets/hover-card.preset.ts`
- Create: `.../addons/actions/presets/open-dialog.preset.ts`
- Create: `.../addons/actions/presets/index.ts`
- Modify: `.../addons/actions/index.ts` (export presets)
- Test: `presets/hover-card.preset.spec.ts`, `presets/open-dialog.preset.spec.ts`

**Interfaces:**
- Produces (per spec §4.5): `hoverCardAction(o?)`, `hoverCardHandlers(injector, o?)`, `openDialogAction(o?)`, `openDialogHandlers(injector, o?)`, `ACTION_PARAMS` injection token, `HoverCardPresetOptions`, `OpenDialogPresetOptions`. Handlers return `Record<string, RichTextActionHandler>`.
- Consumes: `bindRichTextActions` event shape, the overlay top-layer pattern, `ui-dialog`.

**Context:** Presets are sugar over the public handler API. Render imperatively via `Injector` + `createComponent`, appended to `document.body` and shown in the top layer using the native Popover API (`showPopover()`), per the overlay memory — not z-index. Teardown on hover end / dialog close / unbind. Presets may import Angular (they are Angular-only); only `actions-runtime.ts` stays framework-free.

- [ ] **Step 1: Write failing preset tests**

```typescript
// presets/hover-card.preset.spec.ts
import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { hoverCardAction, hoverCardHandlers } from './hover-card.preset';
import type { RichTextActionEvent } from '../actions-runtime';

function hoverEvent(phase: 'start' | 'end', params: Record<string, unknown>): RichTextActionEvent {
  const el = document.createElement('span');
  document.body.appendChild(el);
  return { actionId: 'preset.hover-card', trigger: 'hover', params: params as never, element: el, domEvent: new Event('mouseover'), phase };
}

describe('hover-card preset', () => {
  it('action definition declares a hover trigger and title/body fields', () => {
    const def = hoverCardAction();
    expect(def.triggers).toEqual(['hover']);
    expect(def.fields?.map((f) => f.key)).toEqual(['title', 'body']);
    expect(def.fields?.find((f) => f.key === 'body')?.required).toBe(true);
  });

  it('custom id/label and extraFields are respected', () => {
    const def = hoverCardAction({ id: 'hc2', label: 'My Card', extraFields: [{ key: 'k', label: 'K', type: 'text' }] });
    expect(def.id).toBe('hc2');
    expect(def.label).toBe('My Card');
    expect(def.fields?.some((f) => f.key === 'k')).toBe(true);
  });

  it('handler renders a card on start and removes it on end', () => {
    const injector = TestBed.inject(Injector);
    const handlers = hoverCardHandlers(injector);
    handlers['preset.hover-card'](hoverEvent('start', { title: 'T', body: 'B' }));
    expect(document.body.textContent).toContain('B');
    handlers['preset.hover-card'](hoverEvent('end', { title: 'T', body: 'B' }));
    // after close delay the card is gone; force any timers if the impl uses them
  });
});
```

```typescript
// presets/open-dialog.preset.spec.ts
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { openDialogAction, openDialogHandlers } from './open-dialog.preset';
import type { RichTextActionEvent } from '../actions-runtime';

function clickEvent(params: Record<string, unknown>): RichTextActionEvent {
  const el = document.createElement('span');
  return { actionId: 'preset.open-dialog', trigger: 'click', params: params as never, element: el, domEvent: new Event('click'), phase: 'start' };
}

describe('open-dialog preset', () => {
  it('definition declares click trigger + title/body/confirmLabel fields', () => {
    const def = openDialogAction();
    expect(def.triggers).toEqual(['click']);
    expect(def.fields?.map((f) => f.key).sort()).toEqual(['body', 'confirmLabel', 'title'].sort());
  });

  it('opens a dialog on click and fires onConfirm with params', async () => {
    const injector = TestBed.inject(Injector);
    const onConfirm = vi.fn();
    const handlers = openDialogHandlers(injector, { onConfirm });
    handlers['preset.open-dialog'](clickEvent({ title: 'T', body: 'B', confirmLabel: 'Go' }));
    expect(document.body.textContent).toContain('B');
    const confirmBtn = document.querySelector('[data-testid="preset-dialog-confirm"]') as HTMLButtonElement;
    confirmBtn.click();
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'T' }));
  });

  it('serialized HTML for a preset action contains nothing preset-specific (zero lock-in)', () => {
    const el = document.createElement('span');
    el.setAttribute('data-action-click', openDialogAction().id);
    el.setAttribute('data-action-click-params', JSON.stringify({ title: 'T', body: 'B' }));
    expect(el.outerHTML).not.toContain('preset-dialog');
    expect(el.outerHTML).toContain('data-action-click="preset.open-dialog"');
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement the overlay util + presets**

```typescript
// presets/preset-overlay.utils.ts
import { ApplicationRef, createComponent, type Injector, type Type } from '@angular/core';

/** Imperatively mount a standalone component into the top layer; returns teardown. */
export function mountTopLayer<C>(
  injector: Injector, component: Type<C>, init: (instance: C) => void,
): { instance: C; destroy: () => void } {
  const appRef = injector.get(ApplicationRef);
  const host = document.createElement('div');
  host.setAttribute('popover', 'manual');
  document.body.appendChild(host);
  const ref = createComponent(component, { environmentInjector: appRef.injector, hostElement: host });
  init(ref.instance);
  appRef.attachView(ref.hostView);
  const popover = host as HTMLElement & { showPopover?: () => void; hidePopover?: () => void };
  popover.showPopover?.();
  return {
    instance: ref.instance,
    destroy: () => {
      popover.hidePopover?.();
      appRef.detachView(ref.hostView);
      ref.destroy();
      host.remove();
    },
  };
}
```

```typescript
// presets/hover-card.preset.ts
import { ChangeDetectionStrategy, Component, type Injector, input } from '@angular/core';
import { mountTopLayer } from './preset-overlay.utils';
import type { RichTextActionDefinition, RichTextActionField } from '../rich-text-actions.types';
import type { RichTextActionEvent, RichTextActionHandler } from '../actions-runtime';

export interface HoverCardPresetOptions {
  id?: string;
  label?: string;
  extraFields?: RichTextActionField[];
  side?: 'top' | 'bottom' | 'left' | 'right';
  openDelay?: number;
  closeDelay?: number;
}

const DEFAULT_ID = 'preset.hover-card';

/** A ready-made hover-card action definition (tier-1 title/body fields). */
export function hoverCardAction(o: HoverCardPresetOptions = {}): RichTextActionDefinition {
  return {
    id: o.id ?? DEFAULT_ID,
    label: o.label ?? 'Hover card',
    icon: 'sparkles',
    triggers: ['hover'],
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'body', label: 'Body', type: 'textarea', required: true },
      ...(o.extraFields ?? []),
    ],
  };
}

@Component({
  selector: 'ui-preset-hover-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-[calc(100vw-2rem)] sm:max-w-xs rounded-md border bg-popover p-3 shadow-md">
      @if (title()) { <p class="mb-1 text-sm font-semibold">{{ title() }}</p> }
      <p class="text-sm text-muted-foreground">{{ body() }}</p>
    </div>`,
})
class PresetHoverCardComponent {
  readonly title = input('');
  readonly body = input('');
}

/** Handlers for the hover-card preset. Spread into your handler map. */
export function hoverCardHandlers(
  injector: Injector, o: HoverCardPresetOptions = {},
): Record<string, RichTextActionHandler> {
  const id = o.id ?? DEFAULT_ID;
  let open: { destroy: () => void } | null = null;
  const closeDelay = o.closeDelay ?? 300;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const handler: RichTextActionHandler = (event: RichTextActionEvent) => {
    if (event.phase === 'start') {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      open?.destroy();
      open = mountTopLayer(injector, PresetHoverCardComponent, (inst) => {
        (inst as unknown as { title: unknown; body: unknown });
      });
      // set inputs via componentRef would be cleaner; use signals through setInput on the ref.
    } else {
      closeTimer = setTimeout(() => { open?.destroy(); open = null; }, closeDelay);
    }
  };
  return { [id]: handler };
}
```

Note: `mountTopLayer` returns only `{ instance, destroy }`; to set signal inputs use `ref.setInput`. Adjust `mountTopLayer` to also return the `ComponentRef` (or accept a `Record<string, unknown>` of inputs and call `setInput` for each). Update the util signature to `mountTopLayer(injector, component, inputs: Record<string, unknown>)` and call `ref.setInput(k, v)` for each entry, positioning near the anchor with `event.element.getBoundingClientRect()` + fixed styles on `host`. Implement the open-dialog preset analogously using `ui-dialog` (or a minimal dialog component) with a confirm button `data-testid="preset-dialog-confirm"` invoking `o.onConfirm?.(params)`; support the `component` option by rendering the provided `Type` with `ACTION_PARAMS` provided via an injector. Define:

```typescript
// in open-dialog.preset.ts
import { InjectionToken } from '@angular/core';
export const ACTION_PARAMS = new InjectionToken<Record<string, string | number | boolean>>('ACTION_PARAMS');
```

- [ ] **Step 3: Barrels**

```typescript
// presets/index.ts
export * from './hover-card.preset';
export * from './open-dialog.preset';
export * from './preset-overlay.utils';
```
Add `export * from './presets';` to the addon `index.ts`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run packages/components/ui/rich-text-editor/addons/actions/presets`
Expected: PASS. Positioning/top-layer assertions that depend on `showPopover` (unsupported in jsdom) should assert DOM presence/teardown, not visual placement — keep the tests to content + teardown + onConfirm, as written.

- [ ] **Step 5: Commit**

```bash
git add packages/components/ui/rich-text-editor/addons/actions/presets/ packages/components/ui/rich-text-editor/addons/actions/index.ts
git commit -m "feat(rich-text-actions): optional hover-card + open-dialog presets"
```

---

## Task 12: Locales, RTL, and touch pass

**Files:**
- Create: `.../addons/actions/rich-text-actions.locales.ts`
- Modify: dialog, popover, form, presets to consume locale strings; runtime touch path
- Test: append locale/RTL assertions to dialog spec; touch test to runtime spec

**Interfaces:**
- Produces: `RichTextActionsLocale` (extends `LocaleMeta`), `RICH_TEXT_ACTIONS_LOCALES: Record<'en' | 'he', RichTextActionsLocale>`, directive input `uiRteActionsLocale: LocaleInput<RichTextActionsLocale>`.

- [ ] **Step 1: Write failing locale + touch tests**

```typescript
// append to rich-text-actions-dialog.component.spec.ts
it('renders Hebrew strings and RTL when a he locale is supplied', () => {
  const fixture = TestBed.createComponent(RichTextActionsDialogComponent);
  const ref = fixture.componentRef;
  ref.setInput('definitions', []);
  ref.setInput('context', { mode: 'create', targetKind: 'text', selectionText: 's', occupiedTriggers: [], prefill: null });
  ref.setInput('locale', { rtl: true, dialog: { attachTitle: 'צירוף פעולה', cancel: 'ביטול', attach: 'צרף' } });
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('ביטול');
});
```

```typescript
// append to actions-runtime.spec.ts
it('tap-to-hover: first tap shows hover and suppresses click; second tap fires click', () => {
  const el = document.createElement('div');
  el.innerHTML = '<span data-action-hover="h" data-action-click="c">t</span>';
  document.body.appendChild(el);
  const events: string[] = [];
  const off = bindRichTextActions(el, {
    handlers: { h: (e) => events.push('hover:' + e.phase), c: () => events.push('click') },
    touchHoverBehavior: 'tap-to-hover',
  });
  const span = el.querySelector('span') as HTMLElement;
  span.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
  expect(events).toEqual(['hover:start']);
  span.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
  expect(events).toContain('click');
  off(); el.remove();
});
```

If `TouchEvent` is unavailable in jsdom, construct via `new Event('touchend', { bubbles: true })` and cast. Run → FAIL.

- [ ] **Step 2: Add locales + wire them + touch path**

Create `rich-text-actions.locales.ts` following `rich-text-locales.ts` shape (`extends LocaleMeta`, `rtl: boolean`, nested string groups for `dialog`, `popover`, `fields`). Provide `en` and `he`. In the directive add `readonly uiRteActionsLocale = input<LocaleInput<RichTextActionsLocale>>(...)` and pass the resolved locale into the created dialog/popover via `setInput('locale', ...)`. Replace hardcoded English in the dialog/popover/form templates with `locale().*` reads (add a `locale` input to each, defaulting to `en`). Implement the `touchend` path in `actions-runtime.ts` per Task 9 note, honoring `touchHoverBehavior`.

- [ ] **Step 3: Run + full RTL viewport check**

Run: `npx vitest run packages/components/ui/rich-text-editor/addons/actions`
Then manually verify the demo/story at 320/375/768/1920 and in RTL (Task 15 builds the demo; if running before it, use the storybook story). Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/components/ui/rich-text-editor/addons/actions/
git commit -m "feat(rich-text-actions): locales (en/he), RTL, touch tap-to-hover"
```

---

## Task 13: Registry entry via `sync-registry --fix`

**Files:**
- Modify (generated): `packages/components/registry.json`, `packages/cli/src/registry/index.ts`
- Command: the repo's sync-registry script

**Interfaces:**
- Produces: registry entry `rich-text-editor/actions` (`type: 'addon'`, `parent: 'rich-text-editor'`, `attach`, `requiresBaseFiles`, deps incl. `hover-card`), exactly the shape in spec §8.1.

- [ ] **Step 1: Run the registry sync**

Run: `npx tsx packages/cli/scripts/sync-registry.ts --fix` (confirm the real invocation from `package.json` scripts — likely `npm run sync-registry -- --fix`).
Expected: regenerates `registry.json` + `index.ts` snapshot, discovers the new addon folder.

- [ ] **Step 2: Verify the entry shape**

Run: `node -e "const r=require('./packages/components/registry.json'); const e=(function f(o){if(Array.isArray(o))return o.map(f).find(Boolean);if(o&&typeof o==='object'){if(o.name==='rich-text-editor/actions')return o;for(const k in o){const v=f(o[k]);if(v)return v;}}})(r); console.log(JSON.stringify(e,null,2));"`
Expected: entry present with `type: 'addon'`, `parent: 'rich-text-editor'`, `attach.selector === 'uiRteActions'`, `requiresBaseFiles` listing the host + sanitizer + markdown files, `dependencies` including `rich-text-editor`, `dialog`, `hover-card`.

If any field is wrong, the generator's inference from `index.ts`/`attach` metadata needs a hint. Check `sync-registry.ts` for how `attach` is derived (the context-menu addon is the reference); add the `attach` block to the addon's `index.ts` export comment or the generator's config exactly as the context-menu addon does.

- [ ] **Step 3: Validate + why**

Run: `npx tsx packages/cli/scripts/validate-registry.mjs` (or `npm run validate-registry`) and `npx shadcn-angular why rich-text-editor`.
Expected: validator passes with zero warnings (no deep imports); `why` lists `rich-text-editor/actions` as an addon.

- [ ] **Step 4: Commit**

```bash
git add packages/components/registry.json packages/cli/src/registry/index.ts
git commit -m "chore(registry): register rich-text-editor/actions addon"
```

---

## Task 14: E2E harness + spec

**Files:**
- Modify: `e2e/orchestrator/specs.ts` (add `EXPLICIT_SPECS` entry)
- Create: `e2e/harness/rte-actions/rte-actions-demo.component.ts`
- Create: `e2e/harness/rte-actions/rte-actions.spec.ts`

**Interfaces:**
- Consumes: installed `rich-text-editor` + `rich-text-editor/actions` + `dialog` + `hover-card`.

**Context:** This is a multi-component install, so it MUST be an `EXPLICIT_SPECS` entry (spec §10.9) — do NOT scaffold a single-component spec. Follow the existing data-table/context-menu multi-component entry in `specs.ts` (lines ~83-90) as the template.

- [ ] **Step 1: Add the EXPLICIT_SPECS entry**

In `e2e/orchestrator/specs.ts`, add to `EXPLICIT_SPECS`:

```typescript
{
  names: ['rich-text-editor', 'rich-text-editor/actions', 'dialog', 'hover-card'],
  label: 'rte-actions',
},
```

- [ ] **Step 2: Write the demo component**

Create `e2e/harness/rte-actions/rte-actions-demo.component.ts` — a standalone Angular component that registers a click `open-dialog` action and a hover `term` action, renders the editor with `[uiRteActions]`, and a "published" pane binding `[innerHTML]` + `[uiRichTextActions]` that opens a `ui-dialog` and shows a `ui-hover-card`. Give each interactive element a `data-testid`. Model it on an existing harness demo (look at any `e2e/harness/<name>/<name>-demo.component.ts`).

- [ ] **Step 3: Write the spec**

Create `e2e/harness/rte-actions/rte-actions.spec.ts` covering spec items 62–67: addon compiles/installs (the harness build itself proves AOT), attach a click action via the toolbar and click the published phrase to open the dialog, hover to show the card and Esc to hide, a preset quick-start path, and a round-trip assertion that `data-action-*` attributes survive.

- [ ] **Step 4: Run the impacted subset**

Run: `npm run e2e -- rte-actions` (and `npm run e2e:impact -- --base origin/master` to preview CI's decision).
Expected: PASS. Also confirm the pre-existing `rich-text-editor` single-component spec still passes (regression, item 67).

- [ ] **Step 5: Commit**

```bash
git add e2e/orchestrator/specs.ts e2e/harness/rte-actions/
git commit -m "test(e2e): rte-actions multi-component harness + spec"
```

---

## Task 15: Demo page + Storybook + docs

**Files:**
- Create: demo page under `demo/` (follow the existing rich-text-editor demo's location/registration)
- Create: `.../addons/actions/rich-text-actions.stories.ts`
- Modify: component docs (the rich-text-editor doc page/section)

**Interfaces:** none new — exercises the public API.

- [ ] **Step 1: Build the demo page**

Create the "Rich Text — Interactive Actions" demo with the six sections from spec §9.1: side-by-side author/render, presets quick start (with a preset↔custom-handler swap toggle proving zero lock-in), three tiers of param forms, touch & keyboard, degradation (no runtime bound), styling recipes + RTL. Register it in the demo app's route/nav exactly as the existing rich-text-editor demo is registered (find it and mirror).

- [ ] **Step 2: Write Storybook stories**

Create `rich-text-actions.stories.ts` in the addon folder with the stories from spec §9.2: `Default`, `Presets`, `CustomFormComponent`, `ResolveParams`, `ImageActions`, `EditAndRemove`, `RendererOnly`, `RTL`, `Readonly`, with controls for `uiRteActionsToolbar`/`uiRteActionsSlashCommand`. Model on `rich-text-editor.stories.ts`.

- [ ] **Step 3: Verify demo + stories render**

Run: the repo's storybook/demo dev command (e.g. `npm run storybook` / `npm run demo`) and confirm each story/section renders and the flagship click-to-dialog + hover-card work. Capture at 320/375/768/1920 + RTL per the responsive/touch gates.

- [ ] **Step 4: Docs section**

Add a docs section covering: defining actions, the three param tiers, the render-side directive, the presets quick start, the styling CSS snippet (spec §4.6), and the security note (params are client data, never secrets).

- [ ] **Step 5: Commit**

```bash
git add demo/ packages/components/ui/rich-text-editor/addons/actions/rich-text-actions.stories.ts docs/
git commit -m "docs(rich-text-actions): demo page, storybook stories, usage docs"
```

---

## Task 16: Full-suite gates + logs + publish-boundary verification

**Files:**
- Modify: this plan's Completion Log; `specs/rich-text-actions-addon-spec.md` §13 Completion Log

- [ ] **Step 1: Run the full test suite**

Run: `npm run test-visual`
Expected: fully green (zero failures — the memory's zero-tolerance policy; fix any pre-existing failures surfaced).

- [ ] **Step 2: Lint + Sonar**

Run: `npm run check:all` (or the repo's eslint + sonar entry point).
Expected: zero issues. Fix any cognitive-complexity/readonly/modern-API findings in the new files.

- [ ] **Step 3: E2E impact subset**

Run: `npm run e2e:impact -- --base origin/master`
Expected: green for the rte-actions + rich-text-editor subset.

- [ ] **Step 4: Publish-boundary verification**

Read `packages/cli/src/registry/load.ts` (`isValidRegistryShape`) and `packages/cli/src/registry/index.ts` (`ComponentDefinition`). Confirm no field of the manifest *shape* changed (only data was added; `addons`/`attach`/`requiresBaseFiles` already existed). Conclusion to record: **no npm publish required** — feature is served live from `master`. If any shape field was added, STOP and flag it: it becomes publish-required and must go in the pending-releases memory.

- [ ] **Step 5: Update Completion Logs**

Fill this plan's Completion Log table and append a row to spec §13 with the final review-gate score and rationale for each task. Do not delete any spec history (living-history rule).

- [ ] **Step 6: Commit**

```bash
git add specs/rich-text-actions-addon-spec.md docs/superpowers/plans/2026-07-02-rich-text-actions-addon.md
git commit -m "docs: record rte-actions completion logs + publish-boundary verification"
```

---

## Completion Log

| Task | Date | Review-gate score | Notes |
| --- | --- | --- | --- |
| T1 | 2026-07-02 | 96 | Verbatim extraction to `lib/addon-slots.ts`; re-export keeps data-table's import path; unused `signal` dropped; spec verifies register/teardown/re-export identity. All 530 data-table+lib tests green. |
| T2 | 2026-07-02 | 93 | `registerAttributeRules` ref-counted; locked-attr (`on*`/href/src/style/class) rejected case-insensitively before registration; `on*` still stripped ahead of contributed rules; companion post-pass drops orphan params. Fixed the `as string` assertion + added uppercase locked-attr coverage post-review. 70 tests green, lint clean. |
| T3 | 2026-07-02 | 93 | Discovery spec found `toHtml` mangled action spans (both directions lost actions). `registerSpanSerializer` hook + `toHtml` raw-tag protection (`protectRawTags`/`restoreRawTags`, U+E000/E001 delimiters, restored before sanitize). Text-run round-trip lossless with inner formatting. Documented markdown limits: nested span-in-span, action images. Post-review: collision-strip input, removed non-JSDoc comments, fixed JSDoc. 83 tests green, lint clean. |
| T4 | 2026-07-02 | 93 | `RichTextEditorAddonHost` abstract class; editor `extends` + provides it via `forwardRef` (no addon import). `selection()`/`saveSelection`/`restoreSelection` (made public)/`mutateContent` (one history entry via `applyMutation`)/`wrapSelection` (`surroundContents` + extract fallback)/`toolbarSlots`. Toolbar renders slots after built-ins in top + floating, ordered, `isEnabled`-gated, `getSafeIcon`. Fixed flawed undo test (baseline via mutateContent). 340 editor+toolbar tests green, tsc+lint clean. |
| T5 | 2026-07-02 | 93 | Addon `types.ts` (no `any`, precedence documented), `serializer.ts` (`validateActionId`/`validateActionParams` canonical+idempotent, `writeAction`/`readActions`/`removeAction`, `assertFlatParams`; `readActions` distrusts malformed → `{}`), directive skeleton registering all four sanitizer rules + markdown serializer + toolbar slot + slash command, all guarded by non-empty defs, all torn down on destroy. Fixed SonarJS single-char-class regex. 11 tests green, lint clean. Nits accepted: effect re-register churn (safe via ref-count/onCleanup), overlays scaffolding for T6. |
| T6 | 2026-07-02 | 93 | Tier-1 generated form (required/custom-validate, type coercion, signal params), attach dialog (searchable picker filtered by targetKind/query, trigger radio for multi-trigger, Replace for occupied, `canConfirm` gate), directive `openAttachFlow` (imperative `ViewContainerRef` dialog) + `applyAction` (text wrap / image / existing-merge via host, `assertFlatParams` guard). First review (88) found image-apply re-read selection at confirm time (null after focus loss) → refactored to capture `ApplyTarget` up front; emit only on real write across all 3 paths (text-wrap now guards on `wrapSelection` result too); added image test + search aria-label. 19 tests green, lint+ngc clean. |
| T7 | 2026-07-02 | 92 | Tier-2 `formComponent` hosted via `#formHost` ViewContainerRef using two constructor effects (render keyed on selectedDef+formHost with `renderedFormForDefId` guard; separate `customForm` signal effect syncs params/valid — avoids NG0602 nested-effect). Tier-3 `resolveParams` external flow (`onPick`: busy, resolve, apply/cancel-on-null, `.catch`). Precedence `resolveParams` > `formComponent` > `fields` enforced in `canConfirm`/`syncCustomForm`/`onPick`. `assertFlatParams` rejects non-flat. Post-review: idempotent `closeOverlay` (double-destroy race), added multi-tier diagnostic test. 24 tests green, lint+ngc clean. |
| T8 | 2026-07-02 | 92 | `RichTextActionsPopoverComponent` (edit/remove/add rows) shown caret-driven via content-root mouseup/keyup; `viewReady` (afterNextRender) gates contentRoot-touching effects so it's never undefined pre-view-init. Remove captures id first, unwraps only bare spans, via `mutateContent`. Edit reopens dialog in `mode:'edit'` with `applyPrefill` auto-select. Unknown ids → remove-only. Injected scoped visualization `<style>`. Readonly gates all entry points. Post-review: native Popover top-layer rendering (overlay memory), ref-counted style for concurrent editors, outside-pointerdown dismiss. 30 tests green, lint+ngc clean. |
| T9 | 2026-07-02 | 96 | Framework-free `bindRichTextActions` (one delegated listener set: click/mouseover-out/focusin-out/keydown/touchend); innermost-wins, specific-before-`*`, hover start/end with relatedTarget-containment no-refire, params via `readActions` (distrusts DOM→`{}`), a11y affordances apply/revert, `decorateClass:null`. Module-purity test (`?raw` scan, no `@angular`). First review (88) found tap-to-hover missed `preventDefault` (real-device synthetic double-fire) + no tap-outside reset → replaced WeakSet with stateful `tapHoverEl`, preventDefault on emit, tap-outside delivers end. 15 tests green, lint clean. |
| T10 | 2026-07-02 | 93 | `RichTextActionsBindDirective` (`[uiRichTextActions]`): effect rebuilds options from 4 inputs → rebind (unbind-first, no leak) + observer; `MutationObserver{childList,subtree}` (not attributes → no decoration loop) re-binds via stored `latestOptions`; destroy unbinds + disconnects. Added `*?raw` ambient decl for T9 purity spec typecheck. Tests set innerHTML directly (delegated delivery + observer re-decoration) avoiding `bypassSecurityTrustHtml` hotspot. 47 tests green, lint+ngc+tsc clean. |
| T11 | 2026-07-02 | 92 | Presets: `mountTopLayer` (native top-layer popover + detectChanges), `hoverCardAction`/`hoverCardHandlers` (grace-area mouseenter/leave, Esc, DestroyRef teardown), `openDialogAction`/`openDialogHandlers` (`ui-button` chrome, `ACTION_PARAMS` token + `NgComponentOutlet`, DestroyRef teardown), zero-lock-in test. First review (86) found incomplete grace-area, no owner-destroy teardown, raw markup → added all three; second review (92) found injector-destroy bypassed `dismiss` (keydown leak) → track dismissers not overlays. Fixed button import depth + test isolation (`afterEach`). 59 tests green, lint+ngc+tsc clean. |
| T12 | 2026-07-03 | 92 | `rich-text-actions.locales.ts` (en/he, `LocaleMeta`); dialog/popover/form gain `locale` input, all English literals localized; dialog + popover `[attr.dir]="dir()"` (rtl-or-null); form `requiredTemplate`; directive `uiRteActionsLocale` resolved via `createLocaleBindings` and pushed to created overlays. Post-review: use `interpolate()` (not `.replace()`) so user selection text with `$&` renders safely. he/RTL test. 60 tests green, lint+ngc clean. |

---

## Notes for the executing agent

- **Verify names before you trust this plan.** Several editor-internal names (`selectedImage`, the `disabled`/`readonly` input names, `htmlToMarkdown`/`markdownToHtml`, `component.undo()`) are inferred from grep, not confirmed line-by-line. Task 3 Step 1 and Task 4 Step 1 explicitly begin by confirming real names against source; do the same wherever a call target isn't obviously present. This is the zero-assumptions rule — a wrong method name is a plan bug, not your bug, but you must catch it before writing the implementation.
- **Run `review-gate` after every task**, target ≥95 (hard floor 91). Address feedback and re-dispatch before advancing. Record the score in both Completion Logs.
- **Commit after every task** (each task's final step). Keep commits scoped to the task.
- **The security boundary is Task 2's job and nothing else's.** No addon file may parse or trust `data-action-*` values without going through the serializer's validators; the runtime re-validates because it must distrust its DOM input (Task 9 test "gives handler {}").
