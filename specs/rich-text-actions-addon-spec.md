# Rich Text Editor — Interactive Actions Addon (`rich-text-editor/actions`)

> **Status:** Approved design — ready for implementation planning
> **Date:** 2026-07-02
> **Author:** brainstormed with maintainer; this document is the living spec.
> Never delete resolved items — mark them fixed and append below.

---

## 1. Overview

Let content authors select text (or an image) in `<ui-rich-text-editor>` and attach
**premade interactive actions** to it — "open the pricing dialog on click",
"show a profile hover card on hover". The *developer* defines which actions exist
and what they do (callbacks); the *author* picks an action and fills its
parameters; the *reader* clicks/hovers the rendered HTML and the developer's
callback fires.

The feature ships as an **addon** (`rich-text-editor/actions`) using the addon
system introduced by `data-table/context-menu`: a directive attached to the base
editor, wired through a DI-provided addon host. The base editor ships zero
action code.

### Design pillars

1. **The HTML output stays inert and portable.** Actions serialize as
   `data-action-*` attributes only — no scripts, no handlers, no side-channel
   documents. The HTML can be stored, emailed, SSR'd, or rendered anywhere;
   without a runtime it degrades to plain text/images.
2. **Developers own behavior; we own plumbing.** We never open dialogs or hover
   cards ourselves. We deliver a typed event (`actionId`, `params`, `element`,
   `trigger`, `domEvent`) via delegated listeners; the dev does whatever they
   want with it. No viewer component lock-in.
3. **Three-tier params customization.** Declarative fields (generated form) →
   custom Angular form component → fully external `resolveParams` flow.
4. **Security boundary stays in the base sanitizer.** Addons may only narrowly
   *widen* the attribute allow-list with per-attribute validators; params are
   validated as flat JSON objects of primitives.

### Explicit non-goals (v1)

- No built-in hover-card/dialog rendering (the demo shows how; the library
  doesn't do it for you).
- No actions on whole block elements (paragraphs, quotes) — text runs and
  images only.
- No more than one action per trigger per element (one `click` + one `hover`
  max on the same element).
- No nested/complex param values (flat primitives only).
- No cross-frame/iframe delivery, no email-client interactivity.

---

## 2. Personas & Use Cases

Three roles exist in every deployment:

| Role | Who | Touches |
| --- | --- | --- |
| **Developer** | Builds the app embedding the editor | Action definitions, callbacks, render wiring |
| **Author** | End user editing content (e.g. CMS editor, page builder user) | Toolbar/slash UI, params form |
| **Reader** | End user viewing the published page | Clicks/hovers the rendered content |

### UC-1 — Click-to-open dialog (primary, from the client request)

A SaaS lets customers edit their own landing pages with the rich text editor.
The developer registers `open-dialog` with a `select` field listing the app's
registered dialogs (`Pricing`, `Contact`, `Book a demo`). The author selects the
words "book a demo call", attaches *Open dialog → Book a demo*. On the published
page, the phrase renders styled as interactive; a reader clicking it fires the
dev's callback, which opens their `ui-dialog`.

### UC-2 — Hover card (primary, from the client request)

A knowledge-base app registers `term-preview` (`hover` trigger) with fields
`{ termId: select }`. Authors mark up glossary terms. Readers hovering a term
see a `ui-hover-card` the dev anchors to the delivered `element`; on touch
devices the first tap shows the card, second tap (if the element also has a
click action) fires the click.

### UC-3 — Clickable image

A catalog author attaches `open-product` (`click`, field `productSku: text`) to
an inline product image. Readers click the image → dev navigates or opens a
quick-view dialog.

### UC-4 — Custom form component (tier 2)

The dev's action `link-entity` needs an async, searchable entity picker with a
preview pane — beyond declarative fields. They supply
`formComponent: EntityPickerFormComponent`; the addon renders it inside its
attach/edit dialog, gating Apply on the component's `valid` signal.

### UC-5 — Fully external flow (tier 3)

The dev's action `insert-campaign` reuses an existing multi-step campaign
wizard. They supply `resolveParams`; picking the action opens *their* wizard
(no addon dialog at all), which resolves `{ campaignId: 'c-42' }` or `null`
to cancel.

### UC-6 — Editing and removing

An author clicks inside previously-actioned text → an edit popover appears →
they change the dialog target, or remove the hover action while keeping the
click action, or remove all actions (unwrapping the span if nothing else
styles it).

### UC-7 — Both triggers on one span

Marketing wants "Enterprise plan" to show a summary hover card *and* open the
full pricing dialog on click. Two attach passes on the same selection; the span
carries both `data-action-hover` and `data-action-click`.

### UC-8 — Degradation without runtime

The same HTML is rendered in an email digest and a plain CMS preview. No
runtime is bound → the text renders as ordinary styled text; nothing is
broken, nothing dangles.

---

## 3. Serialization Format (the contract everything hangs on)

**Scheme A — dedicated attributes, JSON params** (approved over a single JSON
blob and over id-reference side-channels):

```html
<!-- text target: hover + click on the same run -->
<span
  data-action-click="open-dialog"
  data-action-click-params='{"dialogId":"pricing"}'
  data-action-hover="term-preview"
  data-action-hover-params='{"termId":"sla"}'
>Enterprise plan</span>

<!-- image target -->
<img src="…" alt="Aurora lamp"
  data-action-click="open-product"
  data-action-click-params='{"productSku":"AUR-01"}'>
```

### Rules

| Attribute | Value constraint | Enforced by |
| --- | --- | --- |
| `data-action-click` / `data-action-hover` | action id matching `/^[\w][\w.-]*$/` (same namespacing style as slash-command ids) | sanitizer validator + attach-time check |
| `data-action-click-params` / `data-action-hover-params` | JSON **object**, depth 1, values `string \| number \| boolean` only; max serialized length 4096 chars | sanitizer validator (parse → shape-check → re-serialize canonical JSON) + attach-time check |

- A `*-params` attribute without its matching id attribute is stripped.
- Invalid JSON / nested objects / arrays / functions-as-strings are stripped
  (the id attribute survives; params become absent → handler receives `{}`).
- Attributes are legal on any allow-listed element, but the authoring UI only
  ever writes them onto `span` (text) and `img` (image). Hand-written HTML
  with actions on e.g. `td` still sanitizes cleanly and the runtime still
  delivers it — harmless and useful for advanced consumers.
- **Markdown mode:** action spans serialize as raw inline HTML inside the
  markdown output (the same strategy task-list checkboxes already use), via a
  new generic span-serializer extension point in `RichTextMarkdownService`
  (see §7.4). Round-trip (`markdown → html → markdown`) must be lossless.

### Why not alternatives (recorded for history)

- **Single `data-actions` JSON blob:** opaque, un-styleable via CSS attribute
  selectors, easier to corrupt. Rejected.
- **Id-reference + side-channel params doc:** two artifacts that drift;
  breaks "it's just HTML" portability. Rejected.

---

## 4. Developer Experience (DX)

### 4.1 Defining actions

```ts
// rich-text-actions.types.ts (addon)
export type RichTextActionTrigger = 'click' | 'hover';

export interface RichTextActionField {
  key: string;                                   // param key, /^[\w.-]+$/
  label: string;
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select';
  required?: boolean;
  placeholder?: string;
  description?: string;                          // helper text under the field
  options?: { value: string; label: string }[];  // for 'select'
  defaultValue?: string | number | boolean;
  validate?: (value: unknown) => string | null;  // return error message or null
}

export interface RichTextActionParamsContext {
  mode: 'create' | 'edit';
  trigger: RichTextActionTrigger;
  currentParams: Record<string, string | number | boolean>;
  selectionText: string;          // '' for image targets
  targetKind: 'text' | 'image';
  targetElement: HTMLElement | null; // null in create-from-selection mode
}

export interface RichTextActionDefinition {
  /** Unique id, serialized into the HTML. Dot-namespaced like slash commands. */
  id: string;
  /** Shown in the action picker. */
  label: string;
  description?: string;
  /** Lucide icon name shown in picker + toolbar affordances. */
  icon?: string;
  /** Which trigger(s) this action can be attached as. */
  triggers: RichTextActionTrigger[];
  /** Which targets the action may attach to. Default: ['text', 'image']. */
  targets?: ('text' | 'image')[];
  /** Tier 1 — declarative fields; the addon generates the form. */
  fields?: RichTextActionField[];
  /** Tier 2 — custom Angular form component rendered inside the addon dialog. */
  formComponent?: Type<RichTextActionParamsForm>;
  /** Tier 3 — fully external flow; no addon dialog is shown. */
  resolveParams?: (
    ctx: RichTextActionParamsContext
  ) => Promise<Record<string, string | number | boolean> | null>;
}
```

**Precedence:** `resolveParams` > `formComponent` > `fields` > no params
(attach immediately). Exactly one tier is consulted; supplying several is not
an error, higher tiers simply win (documented; a dev-mode `console.warn` fires
when more than one is present).

**Attach-time validation:** whatever a tier returns is checked against the
flat-primitive rule *before* serialization. Violations reject the attach with a
descriptive `console.error` (dev bug, not author error) and keep the dialog
open in tiers 1–2.

### 4.2 Tier-2 form component contract

```ts
export interface RichTextActionParamsForm {
  /** Set by the addon before render. */
  context: RichTextActionParamsContext;
  /** Two-way params state. Addon reads on Apply. */
  readonly params: WritableSignal<Record<string, string | number | boolean>>;
  /** Gates the Apply button. */
  readonly valid: Signal<boolean>;
}
```

The addon instantiates it with `ViewContainerRef.createComponent`, assigns
`context` and the initial `params` value, renders it in the dialog body, and
enables **Apply** only while `valid()` is true. The component may use any
library or app components (async search, previews, uploads — its business).

### 4.3 Attaching the addon to the editor

```html
<ui-rich-text-editor
  [uiRteActions]="actionDefs"
  [(ngModel)]="content"
  mode="html" />
```

```ts
readonly actionDefs: RichTextActionDefinition[] = [
  {
    id: 'open-dialog', label: 'Open dialog', icon: 'app-window',
    triggers: ['click'],
    fields: [{
      key: 'dialogId', label: 'Dialog', type: 'select', required: true,
      options: [
        { value: 'pricing', label: 'Pricing' },
        { value: 'contact', label: 'Contact us' },
      ],
    }],
  },
  {
    id: 'term-preview', label: 'Term preview', icon: 'sparkles',
    triggers: ['hover'], targets: ['text'],
    fields: [{ key: 'termId', label: 'Glossary term', type: 'text', required: true }],
  },
];
```

Directive inputs/outputs:

| Member | Type | Purpose |
| --- | --- | --- |
| `uiRteActions` | `RichTextActionDefinition[]` | The registry. Empty/absent → no UI appears at all. |
| `uiRteActionsToolbar` | `boolean` (default `true`) | Contribute the toolbar button. |
| `uiRteActionsSlashCommand` | `boolean` (default `true`) | Contribute the `/action` slash command. |
| `uiRteActionsLocale` | `LocaleInput<RichTextActionsLocale>` | i18n override, following the editor's locale-binding pattern. |
| `(actionAttached)` | `output<{ actionId, trigger, params, targetKind }>` | Analytics/hooks after attach. |
| `(actionRemoved)` | `output<{ actionId, trigger, targetKind }>` | Ditto for removal. |

### 4.4 Render-side wiring

**Framework-free core** (`actions-runtime.ts`, zero Angular imports):

```ts
export interface RichTextActionEvent {
  actionId: string;
  trigger: RichTextActionTrigger;
  params: Record<string, string | number | boolean>;
  element: HTMLElement;      // the actioned span/img
  domEvent: Event;           // click / mouseenter / mouseleave / focusin / …
  phase: 'start' | 'end';    // hover: 'start' on enter, 'end' on leave; click: always 'start'
}

export type RichTextActionHandler = (event: RichTextActionEvent) => void;

export interface BindRichTextActionsOptions {
  /** Map handlers per action id, plus optional '*' catch-all. */
  handlers: Record<string, RichTextActionHandler>;
  /** 'tap-to-hover' (default) maps first tap → hover start on coarse pointers; 'off' delivers nothing for hover on touch. */
  touchHoverBehavior?: 'tap-to-hover' | 'off';
  /** Add tabindex=0 + role + keyboard activation to click-actioned elements. Default true. */
  a11yAffordances?: boolean;
  /** Class added to every actioned element found (styling hook). Default 'rte-action'. */
  decorateClass?: string | null;
}

export function bindRichTextActions(
  container: HTMLElement,
  options: BindRichTextActionsOptions,
): () => void;   // unbind
```

Implementation notes (normative):

- **One** delegated listener set on `container`: `click`, `mouseover`/
  `mouseout` (with `closest('[data-action-hover]')` + related-target checks to
  synthesize enter/leave), `focusin`/`focusout`, `keydown` (Enter/Space
  activate click actions), `touchend` for tap-to-hover. No per-element
  listeners → works with `[innerHTML]` re-renders if rebound, and a
  `MutationObserver`-free design keeps it cheap.
- Params are parsed lazily per event, cached on the element via a `WeakMap`.
  Malformed params (shouldn't survive the sanitizer, but the runtime must not
  trust its input) → `{}`.
- Hover delivery: `phase:'start'` on enter, `phase:'end'` on leave — the dev
  needs both to show/hide a hover card. Click delivers a single
  `phase:'start'` event.
- Tap-to-hover on coarse pointers: first tap on a hover-actioned element
  delivers hover `start` and **suppresses** the click action on that tap;
  tapping outside delivers `end`; second tap on the same element delivers the
  click action (if any). Mirrors the library's touch rules (CLAUDE.md §6).
- `a11yAffordances`: click-actioned elements get `tabindex="0"`,
  `role="button"`, `cursor:pointer` (via the decorate class, not inline
  styles); hover-only elements get `tabindex="0"` and deliver hover
  `start`/`end` on `focusin`/`focusout` so keyboard users reach hover cards.
- The unbind function removes every listener and reverses added
  attributes/classes.

**Angular directive** (thin wrapper):

```html
<article [innerHTML]="trustedHtml" [uiRichTextActions]="handlers"></article>
```

```ts
readonly handlers = {
  'open-dialog': (e: RichTextActionEvent) => this.dialogToOpen.set(String(e.params['dialogId'])),
  'term-preview': (e) =>
    e.phase === 'start'
      ? this.hoverCard.showFor(e.element, String(e.params['termId']))
      : this.hoverCard.hide(),
  '*': (e) => this.analytics.track('rte-action', e.actionId),
};
```

Directive re-binds when the input changes and after content mutations
(`inputs: handlers`, `touchHoverBehavior`, `a11yAffordances`,
`decorateClass`; it observes the host with a debounced `MutationObserver`
because `[innerHTML]` replaces nodes — this is the one place an observer is
justified). Cleans up via `DestroyRef`.

**Non-Angular surfaces** get `bindRichTextActions` directly — it is exported
from the addon barrel and has no Angular imports (enforced by a spec test).

### 4.5 Reader-facing styling

The runtime adds `rte-action` (+ `rte-action-click` / `rte-action-hover`) to
actioned elements. The addon ships **no forced styles**; the demo/docs provide
a copy-paste snippet:

```css
.rte-action-click { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
.rte-action-hover { text-decoration: underline dotted; }
@media (hover: none) { .rte-action { text-decoration-style: solid; } }
```

Devs may also target `[data-action-click]` / `[data-action-hover]` directly —
that's a supported, documented benefit of scheme A.

---

## 5. Authoring UX (in-editor)

### 5.1 Entry points

1. **Toolbar button** (`zap` icon, tooltip "Attach action") — contributed via
   the host's toolbar slot registry; appears in both `top` and `floating`
   toolbars. Enabled when: selection is non-empty, OR caret is inside an
   actioned span, OR an image is focused (the image-resizer selection state).
2. **Slash command** `/action` (`id: 'actions.attach'`, `order: 220`,
   `when: ctx => ctx.hasSelection`) — registered through the existing
   `RichTextCommandRegistry`.
3. **Edit affordance** — placing the caret inside an actioned span (or
   selecting an actioned image) shows a compact popover (same pattern as the
   existing link-editing popover).

All entry-point registrations tear down when the directive is destroyed
(registry teardown functions, like the context-menu addon).

### 5.2 Attach dialog (tiers 1–2)

```text
┌──────────────────────────────────────────────┐
│ Attach action to “Enterprise plan”        ✕ │
│                                              │
│ Action                                       │
│ ┌──────────────────────────────────────────┐ │
│ │ ⌕ Search actions…                        │ │
│ │ ⚡ Open dialog          on click          │ │
│ │ ✦ Term preview          on hover          │ │
│ │ 🛒 Open product         on click          │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Trigger   (only if the action allows both)   │
│ (●) Click   ( ) Hover                        │
│                                              │
│ ── Parameters ──────────────────────────────│
│ Dialog *                                     │
│ [ Pricing                        ▾ ]         │
│                                              │
│                      [ Cancel ] [ Attach ]   │
└──────────────────────────────────────────────┘
```

- Built from `ui-dialog`, `ui-command` (searchable picker), `ui-select`,
  `ui-input`, `ui-checkbox`, `ui-button` — package components per the
  composition rule.
- Picker filters by label/description; each row shows icon, label, and a
  trigger badge. Actions whose `targets` exclude the current target kind are
  hidden.
- If the action supports one trigger, the trigger radio is hidden. If the
  element already has that trigger occupied by another action, Attach is
  replaced by **Replace** with an inline notice ("This will replace *Term
  preview* on hover").
- Tier 1 renders generated fields with `required` gating; tier 2 swaps the
  parameters section for the dev's `formComponent`. Tier 3 skips the dialog
  entirely (the picker still shows — after picking, `resolveParams` runs; a
  busy spinner overlays the picker until it resolves).
- Dialog is responsive (`max-w-[calc(100vw-2rem)] sm:max-w-md`), fields stack,
  padding follows the density system (no hardcoded `p-6`).
- Keyboard: full tab order, `Enter` submits when valid, `Esc` cancels. Focus
  returns to the editor selection on close (restore saved range).

### 5.3 Applying to the DOM

- **Text selection:** wrap the range in a `span` carrying the attributes. If
  the selection exactly covers an existing action span, merge attributes onto
  it. Partial overlap with an existing action span → the new span nests
  normally (inner-most wins at runtime because delegation uses `closest()`;
  documented). Selection spanning block boundaries → split per block (same
  strategy the editor's inline formatting already uses).
- **Image:** set the attributes directly on the `img`.
- Apply goes through the host's content-mutation hook so history (undo/redo),
  re-sanitization, and `htmlChange`/`markdownChange` all fire exactly like a
  built-in format command. **Undo after attach removes the action; redo
  restores it.**

### 5.4 In-editor visualization

- Editor-scoped stylesheet (addon injects a class on the content root):
  `[data-action-click], [data-action-hover]` get a dotted underline +
  `bg-primary/5` tint; images get a 2px dashed outline + a corner ⚡ badge.
  Distinct from link styling (solid underline) so authors can tell them apart.
- Actions **never fire** inside the editor — the editor never binds the
  runtime; attributes are inert there by construction.

### 5.5 Edit popover

```text
        ┌───────────────────────────────┐
        │ ⚡ Open dialog · click    ✎  🗑 │
        │ ✦ Term preview · hover   ✎  🗑 │
        │ + Add action                  │
        └───────────────────────────────┘
```

- Anchored to the actioned element (existing link-popover pattern, native
  Popover API top layer per the overlay memory).
- ✎ reopens the dialog in `mode: 'edit'` with `currentParams` prefilled
  (tier 3: calls `resolveParams` with `mode: 'edit'`).
- 🗑 removes that trigger's attributes; removing the last action on a plain
  span (no other attributes/styles) unwraps it.
- If an action id in the HTML has no matching definition (content authored
  under a different registry), the row renders as "`unknown-id` ·
  click (unavailable)" with only 🗑 enabled — content survives, authors can
  clean up.

### 5.6 Author-facing behaviors, edge cases

| Situation | Behavior |
| --- | --- |
| Selection empty + toolbar click | Button disabled (tooltip explains) |
| Selection is entirely inside an actioned span | Dialog opens in edit mode for that span |
| Copy/paste actioned content within the editor | Attributes survive (sanitizer allows them) |
| Paste from external source containing `data-action-*` | Survives sanitization if valid — intentional (content migration) |
| Markdown mode | Spans serialize as inline HTML; round-trip lossless (§7.3) |
| RTL | Dialog, popover, badges mirror; no LTR-only offsets |
| Editor `readonly`/`disabled` | Entry points hidden/disabled |

---

## 6. Reader UX (rendered page)

- Click-actioned elements: pointer cursor, `role="button"`, `tabindex="0"`,
  Enter/Space activation.
- Hover-actioned elements: hover start/end events; keyboard focus delivers the
  same pair; touch uses tap-to-hover (§4.4).
- Nested actions (span inside span): the innermost actioned ancestor of the
  event target wins; one event per gesture, no double-fire.
- No runtime bound → completely inert, zero console noise.
- 44×44 touch targets are the dev's styling responsibility for tiny inline
  spans, but the docs call it out; the global `pointer: coarse` baseline in
  consumers' `tailwind.css` (library init) already pads interactive elements.

---

## 7. Technical Design (TDD)

### 7.1 File layout

```text
packages/components/ui/rich-text-editor/
  rich-text-editor.host.ts            # NEW (base) — addon host abstraction
  rich-text-sanitizer.service.ts      # MODIFIED (base) — attribute contribution API
  rich-text-markdown.service.ts       # MODIFIED (base) — span-serializer extension
  rich-text-editor.component.ts       # MODIFIED (base) — provides host, toolbar slots
  sub/rich-text-toolbar.component.*   # MODIFIED (base) — render host toolbar slots
  addons/
    actions/
      index.ts                        # barrel: directive, types, runtime, bind-directive
      rich-text-actions.directive.ts  # [uiRteActions] — the addon entry
      rich-text-actions.types.ts      # all public types (§4.1, §4.2)
      rich-text-actions.serializer.ts # attr read/write, params validate/canonicalize
      rich-text-actions-dialog.component.ts/.html   # attach/edit dialog
      rich-text-actions-popover.component.ts/.html  # edit popover
      rich-text-actions-form.component.ts/.html     # tier-1 generated form
      rich-text-actions.locales.ts    # i18n strings (en, he at minimum)
      actions-runtime.ts              # framework-free bindRichTextActions
      rich-text-actions-bind.directive.ts  # [uiRichTextActions] render-side wrapper
      *.spec.ts                       # co-located specs for all of the above
```

> Note: addon sub-files follow the `data-table/addons/context-menu` precedent
> (flat inside the addon folder, no `sub/`). The addon folder is **not** its
> own top-level component — registry-wise it is `type: 'addon'`,
> `parent: 'rich-text-editor'`.

### 7.2 Base change 1 — `RichTextEditorAddonHost`

Abstract class provided by `RichTextEditorComponent` (`providers: [{ provide:
RichTextEditorAddonHost, useExisting: … }]`), mirroring `DataTableAddonHost`:

```ts
export interface RichTextToolbarSlot {
  readonly id: string;
  readonly icon: string;
  readonly tooltip: string;
  readonly order?: number;
  readonly isEnabled?: () => boolean;    // polled reactively via signal deps
  readonly isActive?: () => boolean;
  readonly onClick: (event: Event) => void;
}

export interface RichTextSelectionSnapshot {
  readonly kind: 'text' | 'image' | 'none';
  readonly text: string;
  readonly range: Range | null;          // cloned
  readonly imageElement: HTMLImageElement | null;
  /** Nearest ancestor element carrying any of the given attributes, if the
   *  caret/selection sits inside one. */
  closestWithAttrs(attrs: readonly string[]): HTMLElement | null;
}

export abstract class RichTextEditorAddonHost {
  /** Toolbar slot registry (AddonSlotRegistry<RichTextToolbarSlot> reused from data-table.host.ts — extract to lib/addon-slots.ts). */
  abstract readonly toolbarSlots: AddonSlotRegistry<RichTextToolbarSlot>;
  /** The existing slash-command registry. */
  abstract readonly commands: RichTextCommandRegistry;
  /** Reactive selection/caret snapshot (signal, updated on selectionchange within the editor). */
  abstract selection(): RichTextSelectionSnapshot;
  /** Save/restore the DOM selection around dialog interactions. */
  abstract saveSelection(): void;
  abstract restoreSelection(): void;
  /** Run a DOM mutation against the content root inside the editor's transaction: history entry, re-sanitize, emit change events. */
  abstract mutateContent(mutate: (root: HTMLElement) => void): void;
  /** Wrap the current (restored) text selection in an element built by the callback; handles block-splitting; returns created/merged elements. */
  abstract wrapSelection(build: () => HTMLElement) : HTMLElement[];
  /** Editor state the addon needs for guards. */
  abstract readonly disabled: Signal<boolean>;
  abstract readonly readonly: Signal<boolean>;
  /** Content root element (for scoped stylesheet class + popover anchoring). */
  abstract readonly contentRoot: HTMLElement;
}
```

`AddonSlotRegistry` moves from `data-table.host.ts` to
`packages/components/lib/addon-slots.ts` (re-exported from its old location
for backward compat) so both hosts share it.

The toolbar component renders host slots after built-ins, ordered by `order`,
using the existing custom-item button styling. The `top` and `floating`
toolbars both consume the same registry.

### 7.3 Base change 2 — sanitizer contribution API

```ts
export interface SanitizerAttributeRule {
  /** '*' or a tag name. */
  tag: string;
  attr: string;
  /** Return the sanitized value to keep, or null to strip. */
  validate?: (value: string, element: HTMLElement) => string | null;
}

// RichTextSanitizerService additions:
registerAttributeRules(rules: SanitizerAttributeRule[]): () => void;
```

- Contributed rules are consulted **after** the built-in allow-list misses,
  **before** the attribute is dropped. Event-handler-pattern attributes
  (`on*`), `href`, `src`, `style`, `class` can never be contributed
  (hard-rejected at registration — the security boundary stays centralized).
- The service is `providedIn: 'root'`; rules therefore apply to every editor
  instance in the app. This matches how the command registry already behaves
  and is acceptable: rules are additive, validated, and namespaced by
  attribute name. (Recorded decision; revisit if per-instance sanitizers ever
  materialize.)
- The actions addon registers, with teardown on directive destroy —
  registration is ref-counted so two editor instances with the addon don't
  double-register / early-unregister:

```ts
[
  { tag: '*', attr: 'data-action-click',        validate: validateActionId },
  { tag: '*', attr: 'data-action-hover',        validate: validateActionId },
  { tag: '*', attr: 'data-action-click-params', validate: validateActionParams },
  { tag: '*', attr: 'data-action-hover-params', validate: validateActionParams },
]
```

`validateActionParams` parses, verifies flat-object-of-primitives ≤4096 chars,
and returns **canonical** `JSON.stringify` output (normalizes quoting/spacing;
defends against `style`-quote-normalization interference — params use only
double quotes inside single-quoted attributes; the serializer writes
attributes via `setAttribute`, never string templates, so encoding is the
browser's problem).

**Post-pass:** after tree sanitization, orphan `*-params` (without matching id
attr) are removed — implemented inside the sanitizer as a generic
"companion attribute" declaration on the rule
(`requiresAttr: 'data-action-click'`).

### 7.4 Base change 3 — markdown span-serializer extension

```ts
// RichTextMarkdownService additions:
export interface MarkdownSpanSerializer {
  /** Return markdown/inline-HTML for this span, or null to pass. */
  serialize(element: HTMLElement, innerMarkdown: string): string | null;
}
registerSpanSerializer(s: MarkdownSpanSerializer): () => void;
```

`spanToMarkdown` consults registered serializers after mention/tag handling.
The addon's serializer emits the span's `outerHTML` with **inner content
replaced by the inner markdown** (so `**bold**` inside an actioned span stays
markdown) when any `data-action-*` attribute is present. The markdown→HTML
direction must pass such inline HTML through to the sanitizer — verify the
existing parser's inline-HTML passthrough; if it strips unknown inline HTML,
extend it minimally (task I-4 validates with a round-trip spec first —
zero-assumptions rule).

### 7.5 The addon directive

```ts
@Directive({ selector: 'ui-rich-text-editor[uiRteActions]', standalone: true })
export class RichTextActionsDirective { … }
```

- Injects `RichTextEditorAddonHost`, `RichTextSanitizerService`,
  `RichTextMarkdownService`, `ViewContainerRef`, `DestroyRef`.
- `effect()`s register/teardown: sanitizer rules (ref-counted), markdown
  serializer, toolbar slot (guarded by `uiRteActionsToolbar` +
  non-empty defs), slash command (`when: ctx ⇒ hasSelection && !readonly`).
- Watches `host.selection()` to drive the edit-popover visibility
  (caret inside `closestWithAttrs(ACTION_ATTRS)`).
- Renders dialog/popover imperatively via `ViewContainerRef.createComponent`
  (context-menu precedent) — nothing in the base template.
- Attach flow: `host.saveSelection()` → dialog/tier-3 → on confirm
  `host.restoreSelection()` → `host.wrapSelection(...)` or
  `host.mutateContent(...)` (image) → emit `(actionAttached)`.

### 7.6 Cognitive-complexity & style compliance

All the usual gates apply (CLAUDE.md §4): no function >15 CC — the runtime's
event dispatch is decomposed (`resolveActionTarget`, `dispatchHover`,
`dispatchClick`, `handleTouch`); `readonly` members; no `any` (params typed as
`Record<string, string | number | boolean>`); modern APIs (`element.dataset`,
`structuredClone` for params copies); locale strings through
`createLocaleBindings`.

---

## 8. Registry, CLI & MCP Integration

### 8.1 Registry entry (regenerated by `sync-registry --fix`, shape recorded here)

```jsonc
{
  "name": "rich-text-editor/actions",
  "type": "addon",
  "parent": "rich-text-editor",
  "category": "forms",                       // same as rich-text-editor
  "description": "Attach premade click/hover actions to text and images; dev-defined callbacks fire on the rendered HTML.",
  "tags": ["rich-text", "actions", "hover-card", "dialog", "interactive", "addon"],
  "files": [ "rich-text-editor/addons/actions/…all files…" ],
  "dependencies": ["rich-text-editor", "dialog", "command", "select", "input", "checkbox", "button", "popover", "icon", "label"],
  "libFiles": ["touch.ts", "addon-slots.ts", "i18n/…"],
  "requiresBaseFiles": [
    "rich-text-editor/rich-text-editor.host.ts",
    "rich-text-editor/rich-text-sanitizer.service.ts",
    "rich-text-editor/rich-text-markdown.service.ts"
  ],
  "attach": {
    "import": "RichTextActionsDirective from './ui/rich-text-editor/addons/actions'",
    "selector": "uiRteActions"
  }
}
```

### 8.2 CLI / MCP behavior (existing machinery, no CLI publish expected)

- `npx shadcn-angular add rich-text-editor/actions` installs addon + base (dep
  resolution), like the context-menu addon.
- MCP `apply_addon { addon: "rich-text-editor/actions" }` wires the directive
  onto an existing `<ui-rich-text-editor>` usage via the `attach` metadata
  (import + selector), reporting `hadConflicts` per the M10a contract.
- `get_component_examples` / demo registry: add an `actions` example so MCP
  clients can fetch copy-paste usage.
- **Publish boundary check:** all changes are component/lib source + registry
  *data* → served live from master, **no npm publish** required (per the
  release-policy memory). If implementation ends up touching
  `ComponentDefinition`'s shape (it should not — `addons`, `attach`,
  `requiresBaseFiles` already exist), that would flip this to publish-required;
  the implementing agent must re-verify against
  `packages/cli/src/registry/load.ts` before asserting.
- Update-path: base-file modifications (sanitizer/markdown/host) change
  pristine baselines for `rich-text-editor` — normal component-update flow
  covers consumers; `diff_component` will show the delta.

---

## 9. Demos & Storybook

### 9.1 Demo page (`demo/` app): "Rich Text — Interactive Actions"

Sections (each with copy-paste code blocks):

1. **Author & render, side by side** — editor with 3 registered actions
   (dialog / hover card / product image); a live "published page" pane
   rendering `htmlChange` output through `[uiRichTextActions]`, opening a real
   `ui-dialog` and anchoring a real `ui-hover-card`. This is the flagship
   answer to "give devs the easiest way".
2. **Three tiers of param forms** — same action implemented with `fields`,
   `formComponent` (async searchable picker), and `resolveParams` (external
   wizard), toggleable.
3. **Touch & keyboard** — hover action demonstrated with tap-to-hover; visible
   note on coarse-pointer behavior.
4. **Degradation** — the same HTML rendered with no runtime bound.
5. **Styling recipes** — the CSS snippet from §4.5, RTL sample.

### 9.2 Storybook (`rich-text-actions.stories.ts` in the addon folder)

- `Default` (three actions, tier 1), `CustomFormComponent`, `ResolveParams`,
  `ImageActions`, `EditAndRemove` (pre-seeded content), `RendererOnly`
  (bind-directive against static HTML), `RTL`, `Readonly` (entry points
  hidden). Controls for `uiRteActionsToolbar` / `…SlashCommand`.

---

## 10. Test Plan (complete list)

### 10.1 Serializer / types (`rich-text-actions.serializer.spec.ts`)

1. writes `data-action-click` + canonical params JSON onto an element
2. rejects nested-object params with descriptive error
3. rejects array / null / function-typed values
4. rejects params >4096 chars serialized
5. rejects invalid action ids (spaces, `<`, empty)
6. reads both triggers off one element into a typed model
7. canonicalization is idempotent (`write(read(x)) === x`)

### 10.2 Sanitizer (base, `rich-text-sanitizer.service.spec.ts` additions)

8. contributed rule allows `data-action-click` on span/img
9. contributed validator strips invalid params JSON but keeps the id attr
10. orphan `*-params` without id attr is stripped (companion-attribute rule)
11. registration teardown removes the rules; ref-count keeps them while a second editor lives
12. attempting to contribute `onclick` / `href` / `style` / `class` throws
13. `on*` handlers still stripped from actioned elements (regression)
14. `rich-text-security.spec.ts`: hostile payloads — `data-action-click-params` containing `"</span><script>"`, `javascript:` strings inside param values (allowed as *data*, must round-trip inertly), zero-width-obfuscated attr names

### 10.3 Markdown (base additions)

15. actioned span round-trips html→md→html losslessly (attrs + inner formatting)
16. actioned span containing bold/link keeps inner markdown semantics
17. mention/tag spans unaffected by registered serializer (regression)
18. md→html passthrough of the inline-HTML form re-sanitizes correctly

### 10.4 Addon host (base, `rich-text-editor.component.spec.ts` additions)

19. toolbar slot renders in top toolbar ordered after built-ins; click fires; `isEnabled` gates
20. toolbar slot renders in floating toolbar
21. `selection()` reports text / image / none kinds correctly
22. `wrapSelection` wraps a simple range; splits across block boundaries; merges onto exact-cover existing span
23. `mutateContent` produces one history entry; undo restores pre-attach HTML; redo re-applies
24. `saveSelection`/`restoreSelection` survive a dialog open/close cycle

### 10.5 Addon directive + authoring UI (`rich-text-actions.directive.spec.ts`, dialog/popover/form specs)

25. no defs → no toolbar slot, no slash command, no sanitizer rules
26. defs present → all three registered; destroy tears all down
27. attach flow (tier 1): pick action → fill required select → Attach → span carries correct attrs; `(actionAttached)` emits
28. Attach disabled until `required` fields valid; `validate` message shown
29. tier 2: formComponent instantiated with context + initial params; Apply gated on `valid()`; returned params serialized
30. tier 3: `resolveParams` called with correct context; `null` cancels cleanly; resolved params attached with no dialog
31. tier precedence: `resolveParams` wins over `formComponent` wins over `fields`; dev-mode warn on multiple
32. non-flat params returned by tier 2/3 rejected with console.error, dialog stays open (tier 2)
33. both triggers attachable to one span (UC-7); occupied trigger shows Replace and replaces
34. image target: attrs land on `img`; actions with `targets:['text']` hidden in picker
35. edit popover appears when caret enters actioned span; lists both actions; edit prefills `currentParams`
36. remove single trigger keeps the other; removing last action unwraps bare span; keeps span with other styling
37. unknown action id in content → popover shows unavailable row, remove-only
38. readonly/disabled editor → no entry points
39. locale override changes dialog strings; RTL rendering sanity
40. slash command `when` hides without selection; runs attach flow with selection

### 10.6 Runtime (`actions-runtime.spec.ts` — pure DOM, no Angular imports; a spec asserts the module graph has no `@angular/*` import)

41. click on actioned span fires handler with id/params/element/domEvent
42. click on nested actioned spans fires innermost only, once
43. hover enter/leave delivers `start`/`end` pair; moving between child nodes of the same span does not re-fire
44. focusin/focusout mirror hover for keyboard; Enter/Space activate click actions
45. `'*'` catch-all receives events with no specific handler; specific + catch-all both fire (specific first)
46. malformed params on element → handler receives `{}` (runtime distrusts input)
47. tap-to-hover: first tap → hover start, click suppressed; second tap → click; tap outside → hover end; `touchHoverBehavior:'off'` delivers nothing
48. a11y affordances applied (tabindex/role/class) and fully reverted on unbind
49. unbind removes all listeners (no handler calls after); double-bind on same container throws or safely rebinds (pick: safe rebind, assert)
50. `decorateClass: null` adds no classes

### 10.7 Render directive (`rich-text-actions-bind.directive.spec.ts`)

51. binds on init, delivers events, cleans up on destroy
52. `[innerHTML]` content swap re-binds (MutationObserver path) — new elements deliver events
53. handler input replacement takes effect without duplicate delivery

### 10.8 E2E (`e2e/orchestrator/specs.ts` — EXPLICIT_SPECS entry)

```ts
{
  names: ['rich-text-editor', 'rich-text-editor/actions', 'dialog', 'hover-card'],
  label: 'rte-actions',
}
```

54. addon installs on pristine app; `apply_addon` wiring compiles (AOT)
55. author attaches a click action via toolbar; published pane click opens real dialog
56. hover action shows hover card on hover; Esc/blur hides
57. content survives editor→storage→renderer round trip (attrs intact post-sanitize)
58. base-only install (existing `rich-text-editor` spec) still passes — base unchanged behaviorally without addon (regression)

### 10.9 Suite gates

- `npm run test-visual` fully green (zero-failure policy), `npm run e2e:impact -- --base origin/master` subset green locally, sonar/eslint clean, `sync-registry.ts` no warnings (no deep imports).

---

## 11. Implementation Task List (for the executing agent)

Rules: TDD per task (superpowers:test-driven-development); review-gate ≥95
after every task (per-task review gate memory); each task compiles + full
relevant specs green before advancing; zero-assumption verification before
claiming behavior.

| # | Task | Scope | Key deliverables | Depends on |
| --- | --- | --- | --- | --- |
| T1 | Extract `AddonSlotRegistry` to `lib/addon-slots.ts`, re-export from `data-table.host.ts` | lib + data-table | moved class, back-compat re-export, existing data-table specs green | — |
| T2 | Sanitizer contribution API (§7.3) | base | `registerAttributeRules` + ref-count + companion-attr post-pass + hard-reject list; tests 8–14 | — |
| T3 | Markdown span-serializer extension (§7.4) | base | `registerSpanSerializer`; **first** write the round-trip spec to discover current inline-HTML passthrough behavior, then extend minimally; tests 15–18 | — |
| T4 | `RichTextEditorAddonHost` (§7.2): host class, editor provides it, toolbar slot rendering (top + floating), selection snapshot, wrap/mutate/save/restore | base | tests 19–24; no behavior change for non-addon users | T1 |
| T5 | Addon skeleton: folder, types (§4.1–4.2), serializer module, directive registering sanitizer rules + markdown serializer + slash command + toolbar slot with teardown | addon | tests 1–7, 25–26 | T2, T3, T4 |
| T6 | Attach dialog + tier-1 generated form + trigger/target logic + apply-to-DOM (text wrap, image, replace-occupied) | addon | tests 27–28, 33–34, 40 + dialog a11y/responsive/density checks | T5 |
| T7 | Tier 2 (`formComponent` contract + hosting) and tier 3 (`resolveParams`), precedence + validation errors | addon | tests 29–32 | T6 |
| T8 | Edit popover (list/edit/remove/unwrap/unknown-id) + in-editor visualization stylesheet + readonly gating | addon | tests 35–39 | T6 |
| T9 | Framework-free runtime `actions-runtime.ts` (§4.4) | addon | tests 41–50 incl. no-Angular-import assertion | T5 (types only) |
| T10 | Render directive `[uiRichTextActions]` | addon | tests 51–53 | T9 |
| T11 | Locales (en/he), RTL pass, touch pass across dialog/popover/runtime | addon | test 39 + manual viewport checks 320→1920 | T6–T10 |
| T12 | Registry: `sync-registry --fix`, entry shape per §8.1, `validate-registry`, `why rich-text-editor` shows addon | tooling | registry.json + snapshot regenerated, zero warnings | T5–T10 |
| T13 | E2E: harness via EXPLICIT_SPECS `rte-actions` (multi-component — do NOT scaffold single), tests 54–58 | e2e | spec passing locally | T12 |
| T14 | Demo page (§9.1) + Storybook stories (§9.2) + docs section in component docs | demo | flagship side-by-side demo | T10 |
| T15 | Full-suite gates (§10.9) + spec log update (this file's Completion Log) + publish-boundary re-verification (§8.2) | all | green evidence pasted into log | all |

Suggested parallelization: T2, T3 and T1→T4 are independent tracks; T9 can
start alongside T6. Everything else is sequential on its deps.

---

## 12. Risks & Resolved Decisions

| Item | Resolution |
| --- | --- |
| Root-provided sanitizer means app-wide rules | Accepted (matches command registry); ref-counted; validators keep it tight. Revisit only if per-instance sanitizers appear. |
| Markdown inline-HTML passthrough unknown | T3 starts with a discovery spec — no assumption. |
| `mode="markdown"` consumers with action content | Round-trip guaranteed by T3's tests; if passthrough proves structurally impossible, fallback decision recorded here before proceeding: actions addon documents `mode="html"` requirement (escalate to maintainer first). |
| Hover on touch | tap-to-hover default, `'off'` opt-out; documented. |
| Params in HTML are visible/tamperable by readers | By design — devs are told (docs) params are client data, never secrets, and callbacks must validate. |
| Nested action spans | Innermost-wins via `closest()`; documented; no UI encourages nesting. |
| Selection wrap across blocks | Reuses editor's existing inline-format splitting via `wrapSelection` host API. |

---

## 13. Completion Log

| Row | Date | Task | Reviewer score | Notes |
| --- | --- | --- | --- | --- |
| _(append as tasks complete)_ | | | | |
