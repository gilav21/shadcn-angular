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

- The **core** runtime never renders UI — it only delivers events. Built-in
  hover-card/dialog rendering exists, but only as the **optional presets
  layer** (§4.6): prebuilt handlers/definitions a dev can opt into, compose
  with their own handlers, or ignore entirely. No lock-in either way.
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

### UC-8 — Zero-config presets (batteries included)

A dev wants the feature working in minutes without designing actions or
writing handlers. They spread the preset definitions into the editor and the
preset handlers into the renderer:

```ts
readonly actionDefs = [hoverCardAction(), openDialogAction()];
readonly handlers = {
  ...hoverCardHandlers(this.injector),
  ...openDialogHandlers(this.injector),
  'my-custom-action': (e) => this.doMyThing(e),   // freely composed
};
```

Authors now attach "Hover card" (title + body authored inline in the params
form) and "Open dialog" (title + body + optional confirm-button label); the
presets render real `ui-hover-card` / `ui-dialog` UI on the published page.
The dev later swaps the dialog preset for their own handler without touching
content — the serialized HTML is identical either way.

### UC-9 — Degradation without runtime

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
| `data-action-click` / `data-action-hover` | action id matching `/^[\w][\w.-]*$/` | sanitizer validator + attach check |
| `data-action-click-params` / `-hover-params` | flat JSON object of primitives, ≤4096 chars | sanitizer validator (parse, check, re-serialize) + attach check |

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

/** Flat params object — the only shape that serializes into the HTML. */
export type ActionParams = Record<string, string | number | boolean>;

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

### 4.5 Optional presets — built-in hover card & dialog (zero lock-in)

The presets layer is **sugar over the public APIs only**: preset action
definitions are ordinary `RichTextActionDefinition`s, preset handlers are
ordinary `RichTextActionHandler`s. They live in a separate module
(`presets/`) that the core never imports — a dev who ignores presets carries
no hover-card/dialog dependency at runtime beyond the installed source.

```ts
// presets/hover-card.preset.ts
export interface HoverCardPresetOptions {
  id?: string;                  // default 'preset.hover-card'
  label?: string;               // picker label, default from locale
  /** Extra fields appended to the built-ins (title, body). */
  extraFields?: RichTextActionField[];
  /** Override rendering: given params + anchor, return content override. */
  content?: (params: ActionParams, element: HTMLElement) => string | TemplateRef<unknown>;
  side?: 'top' | 'bottom' | 'left' | 'right';   // default 'top'
  openDelay?: number;           // ms, default 150
  closeDelay?: number;          // ms, default 300 (allows moving into the card)
}
export function hoverCardAction(o?: HoverCardPresetOptions): RichTextActionDefinition;
export function hoverCardHandlers(injector: Injector, o?: HoverCardPresetOptions): Record<string, RichTextActionHandler>;

// presets/open-dialog.preset.ts
export interface OpenDialogPresetOptions {
  id?: string;                  // default 'preset.open-dialog'
  label?: string;
  extraFields?: RichTextActionField[];
  /** Render a custom component inside the dialog body instead of authored text. */
  component?: Type<unknown>;    // receives params via an ACTION_PARAMS injection token
  /** Called when the optional confirm button is pressed. */
  onConfirm?: (params: ActionParams) => void;
  size?: 'sm' | 'md' | 'lg';    // default 'md'
}
export function openDialogAction(o?: OpenDialogPresetOptions): RichTextActionDefinition;
export function openDialogHandlers(injector: Injector, o?: OpenDialogPresetOptions): Record<string, RichTextActionHandler>;
```

Behavior (normative):

- **Authored content**: `hoverCardAction()` declares tier-1 fields
  `title (text)` + `body (textarea, required)`; `openDialogAction()` declares
  `title (text, required)` + `body (textarea)` + `confirmLabel (text)`. So the
  *author* writes the card/dialog content inline in the editor — the true
  zero-config path. `extraFields` / `content` / `component` scale it up.
- **Rendering**: handlers create real `ui-hover-card`-styled floating content
  and `ui-dialog` instances **imperatively** through the provided `Injector`
  (`createComponent`, appended via the overlay top-layer pattern from the
  overlays memory) — no host component required, works from any container the
  bind directive sits on. Teardown on hover `end` / dialog close / unbind.
- **Hover-card grace area**: pointer may move from anchor into the card
  (`closeDelay`); card is keyboard-dismissable (`Esc`) and stays open while
  focused — the a11y behavior devs get "for free" and usually get wrong.
- **Composition**: `hoverCardHandlers()` returns a plain
  `{ [id]: handler }` map — spread it next to custom handlers (UC-8). Two
  presets with custom `id`s can coexist (e.g. two dialog variants).
- **No lock-in, provably**: swapping a preset for a hand-written handler
  requires **zero content changes** — a preset test asserts the serialized
  HTML contains nothing preset-specific beyond the action id and params.
- Presets are Angular-dependent by nature; the framework-free guarantee
  (§4.4) applies to `actions-runtime.ts` only and a spec keeps enforcing it.

### 4.6 Reader-facing styling

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
      presets/
        hover-card.preset.ts          # hoverCardAction() + hoverCardHandlers()
        open-dialog.preset.ts         # openDialogAction() + openDialogHandlers()
        preset-overlay.utils.ts       # shared imperative-create/top-layer helpers
        index.ts                      # presets barrel (core barrel re-exports it)
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
  "dependencies": ["rich-text-editor", "dialog", "hover-card", "command", "select", "input", "checkbox", "button", "popover", "icon", "label"],
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
2. **Presets quick start** — `hoverCardAction()` + `openDialogAction()` with
   `hoverCardHandlers()` / `openDialogHandlers()` wired in ~10 lines; author
   writes the card/dialog content inline; a toggle swaps the dialog preset
   for a hand-written handler on the *same content* to prove zero lock-in.
3. **Three tiers of param forms** — same action implemented with `fields`,
   `formComponent` (async searchable picker), and `resolveParams` (external
   wizard), toggleable.
4. **Touch & keyboard** — hover action demonstrated with tap-to-hover; visible
   note on coarse-pointer behavior.
5. **Degradation** — the same HTML rendered with no runtime bound.
6. **Styling recipes** — the CSS snippet from §4.6, RTL sample.

### 9.2 Storybook (`rich-text-actions.stories.ts` in the addon folder)

- `Default` (three actions, tier 1), `Presets` (hover-card + dialog presets,
  zero custom handlers), `CustomFormComponent`, `ResolveParams`,
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

- **8.** contributed rule allows `data-action-click` on span/img
- **9.** contributed validator strips invalid params JSON but keeps the id attr
- **10.** orphan `*-params` without id attr is stripped (companion-attribute rule)
- **11.** registration teardown removes the rules; ref-count keeps them while a
  second editor lives
- **12.** attempting to contribute `onclick` / `href` / `style` / `class` throws
- **13.** `on*` handlers still stripped from actioned elements (regression)
- **14.** `rich-text-security.spec.ts`: hostile payloads —
  `data-action-click-params` containing `"</span><script>"`, `javascript:`
  strings inside param values (allowed as *data*, must round-trip inertly),
  zero-width-obfuscated attr names

### 10.3 Markdown (base additions)

- **15.** actioned span round-trips html→md→html losslessly (attrs + inner formatting)
- **16.** actioned span containing bold/link keeps inner markdown semantics
- **17.** mention/tag spans unaffected by registered serializer (regression)
- **18.** md→html passthrough of the inline-HTML form re-sanitizes correctly

### 10.4 Addon host (base, `rich-text-editor.component.spec.ts` additions)

- **19.** toolbar slot renders in top toolbar ordered after built-ins; click
  fires; `isEnabled` gates
- **20.** toolbar slot renders in floating toolbar
- **21.** `selection()` reports text / image / none kinds correctly
- **22.** `wrapSelection` wraps a simple range; splits across block boundaries;
  merges onto exact-cover existing span
- **23.** `mutateContent` produces one history entry; undo restores pre-attach
  HTML; redo re-applies
- **24.** `saveSelection`/`restoreSelection` survive a dialog open/close cycle

### 10.5 Addon directive + authoring UI (directive/dialog/popover/form specs)

- **25.** no defs → no toolbar slot, no slash command, no sanitizer rules
- **26.** defs present → all three registered; destroy tears all down
- **27.** attach flow (tier 1): pick action → fill required select → Attach →
  span carries correct attrs; `(actionAttached)` emits
- **28.** Attach disabled until `required` fields valid; `validate` message shown
- **29.** tier 2: formComponent instantiated with context + initial params;
  Apply gated on `valid()`; returned params serialized
- **30.** tier 3: `resolveParams` called with correct context; `null` cancels
  cleanly; resolved params attached with no dialog
- **31.** tier precedence: `resolveParams` > `formComponent` > `fields`;
  dev-mode warn on multiple
- **32.** non-flat params returned by tier 2/3 rejected with console.error,
  dialog stays open (tier 2)
- **33.** both triggers attachable to one span (UC-7); occupied trigger shows
  Replace and replaces
- **34.** image target: attrs land on `img`; actions with `targets:['text']`
  hidden in picker
- **35.** edit popover appears when caret enters actioned span; lists both
  actions; edit prefills `currentParams`
- **36.** remove single trigger keeps the other; removing last action unwraps
  bare span; keeps span with other styling
- **37.** unknown action id in content → popover shows unavailable row, remove-only
- **38.** readonly/disabled editor → no entry points
- **39.** locale override changes dialog strings; RTL rendering sanity
- **40.** slash command `when` hides without selection; runs attach flow with selection

### 10.6 Runtime (`actions-runtime.spec.ts` — pure DOM; a spec asserts the module graph has no `@angular/*` import)

- **41.** click on actioned span fires handler with id/params/element/domEvent
- **42.** click on nested actioned spans fires innermost only, once
- **43.** hover enter/leave delivers `start`/`end` pair; moving between child
  nodes of the same span does not re-fire
- **44.** focusin/focusout mirror hover for keyboard; Enter/Space activate
  click actions
- **45.** `'*'` catch-all receives events with no specific handler; specific +
  catch-all both fire (specific first)
- **46.** malformed params on element → handler receives `{}` (runtime
  distrusts input)
- **47.** tap-to-hover: first tap → hover start, click suppressed; second tap →
  click; tap outside → hover end; `touchHoverBehavior:'off'` delivers nothing
- **48.** a11y affordances applied (tabindex/role/class) and fully reverted on unbind
- **49.** unbind removes all listeners (no handler calls after); double-bind on
  same container safely rebinds (assert)
- **50.** `decorateClass: null` adds no classes

### 10.7 Render directive (`rich-text-actions-bind.directive.spec.ts`)

- **51.** binds on init, delivers events, cleans up on destroy
- **52.** `[innerHTML]` content swap re-binds (MutationObserver path) — new
  elements deliver events
- **53.** handler input replacement takes effect without duplicate delivery

### 10.8 Presets (`presets/hover-card.preset.spec.ts`, `presets/open-dialog.preset.spec.ts`)

- **54.** `hoverCardAction()` returns a valid definition (hover trigger,
  title/body fields); `extraFields` appended; custom `id`/`label` respected
- **55.** `hoverCardHandlers()`: hover `start` renders the card with authored
  title/body anchored to the element; `end` removes it after `closeDelay`
- **56.** grace area: pointer moving from anchor into the card keeps it open;
  `Esc` closes; card stays open while focused (keyboard a11y)
- **57.** `openDialogHandlers()`: click opens a dialog with authored
  title/body/confirm label; close tears down; `onConfirm` fires with params
- **58.** `component` option renders the custom component with params injected
  via the `ACTION_PARAMS` token
- **59.** two presets with custom ids coexist; returned handler maps spread and
  compose with hand-written handlers
- **60.** zero lock-in: serialized HTML for a preset action contains only the
  action id + params (nothing preset-specific); the same HTML drives a
  hand-written replacement handler unchanged
- **61.** preset overlays render in the top layer above an open modal
  (overlay top-layer pattern); teardown on unbind removes any open overlay

### 10.9 E2E (`e2e/orchestrator/specs.ts` — EXPLICIT_SPECS entry)

```ts
{
  names: ['rich-text-editor', 'rich-text-editor/actions', 'dialog', 'hover-card'],
  label: 'rte-actions',
}
```

- **62.** addon installs on pristine app; `apply_addon` wiring compiles (AOT)
- **63.** author attaches a click action via toolbar; published pane click
  opens real dialog
- **64.** hover action shows hover card on hover; Esc/blur hides
- **65.** presets quick-start path: `hoverCardAction()` + `hoverCardHandlers()`
  compile and work in the pristine consumer app (AOT)
- **66.** content survives editor→storage→renderer round trip (attrs intact
  post-sanitize)
- **67.** base-only install (existing `rich-text-editor` spec) still passes —
  base unchanged behaviorally without addon (regression)

### 10.10 Suite gates

- `npm run test-visual` fully green (zero-failure policy)
- `npm run e2e:impact -- --base origin/master` subset green locally
- sonar/eslint clean; `sync-registry.ts` no warnings (no deep imports)

---

## 11. Implementation Task List (for the executing agent)

Rules: TDD per task (superpowers:test-driven-development); review-gate ≥95
after every task (per-task review gate memory); each task compiles + full
relevant specs green before advancing; zero-assumption verification before
claiming behavior.

| # | Task | Scope | Key deliverables | Depends on |
| --- | --- | --- | --- | --- |
| T1 | Extract `AddonSlotRegistry` to `lib/addon-slots.ts` | lib | moved class, back-compat re-export, data-table specs green | — |
| T2 | Sanitizer contribution API (§7.3) | base | `registerAttributeRules`, ref-count, companion-attr post-pass, hard-reject list; tests 8–14 | — |
| T3 | Markdown span-serializer extension (§7.4) | base | discovery spec FIRST (inline-HTML passthrough), then `registerSpanSerializer`; tests 15–18 | — |
| T4 | `RichTextEditorAddonHost` (§7.2): host, toolbar slots, selection, wrap/mutate | base | tests 19–24; zero behavior change without addon | T1 |
| T5 | Addon skeleton: types (§4.1–4.2), serializer module, directive registrations + teardown | addon | tests 1–7, 25–26 | T2–T4 |
| T6 | Attach dialog, tier-1 form, trigger/target logic, apply-to-DOM | addon | tests 27–28, 33–34, 40; a11y/responsive/density checks | T5 |
| T7 | Tier 2 (`formComponent`) + tier 3 (`resolveParams`), precedence, validation errors | addon | tests 29–32 | T6 |
| T8 | Edit popover (edit/remove/unwrap/unknown-id), in-editor visualization, readonly gating | addon | tests 35–39 | T6 |
| T9 | Framework-free runtime `actions-runtime.ts` (§4.4) | addon | tests 41–50 incl. no-Angular-import assertion | T5 (types) |
| T10 | Render directive `[uiRichTextActions]` | addon | tests 51–53 | T9 |
| T11 | Presets (§4.5): hover-card + open-dialog defs/handlers, overlay utils, `ACTION_PARAMS` token | addon | tests 54–61 | T5, T10 |
| T12 | Locales (en/he), RTL pass, touch pass across dialog/popover/runtime/presets | addon | test 39; viewport checks 320→1920 | T6–T11 |
| T13 | Registry: `sync-registry --fix` (incl. presets), `validate-registry` | tooling | registry + snapshot regenerated, zero warnings | T5–T11 |
| T14 | E2E via EXPLICIT_SPECS `rte-actions` (multi-component — do NOT scaffold single) | e2e | tests 62–67 passing locally | T13 |
| T15 | Demo page (§9.1), Storybook (§9.2), docs section | demo | flagship side-by-side + presets quick start | T11 |
| T16 | Full-suite gates (§10.10), Completion Log update, publish-boundary re-verification (§8.2) | all | green evidence pasted into log | all |

Suggested parallelization: T2, T3 and T1→T4 are independent tracks; T9 can
start alongside T6; T11 can start once T10 lands. Everything else is
sequential on its deps.

---

## 12. Risks & Resolved Decisions

| Item | Resolution |
| --- | --- |
| Root-provided sanitizer means app-wide rules | Accepted (matches command registry); ref-counted; validators keep it tight. |
| Markdown inline-HTML passthrough unknown | T3 starts with a discovery spec — no assumption. |
| `mode="markdown"` consumers with action content | RESOLVED in T3 — see the T3 markdown-mode note below. |
| Hover on touch | tap-to-hover default, `'off'` opt-out; documented. |
| Params in HTML are visible/tamperable by readers | By design — docs state params are client data, never secrets; callbacks must validate. |
| Presets add `hover-card` to the addon's deps | Accepted — presets are the headline DX win; skipping them costs nothing at runtime. |
| Nested action spans | Innermost-wins via `closest()`; documented; no UI encourages nesting. |
| Selection wrap across blocks | Reuses editor's existing inline-format splitting via `wrapSelection` host API. |

**T3 markdown-mode note (resolved).** The discovery spec found `toHtml`'s
`escapeHtmlInContent` mangled action spans — it escaped the `>` closing an
attribute value and the `<` in `</span>` — so both markdown directions lost
the action. Fixed by protecting raw `<span>`/`</span>`/`data-action-*` `<img>`
tags with placeholder tokens around the parse pipeline, restored before the
sanitizer runs (so restored HTML is still validated). Text-run actions now
round-trip in markdown mode with inner formatting preserved. Two accepted
markdown-mode limitations: (a) a nested `<span>` inside an action span may not
round-trip (per-tag protection is non-greedy, not balanced); (b) action
**images** lose `data-action-*` through `toMarkdown` (`handleImageTag` emits
`![alt](src)`; only a span serializer was in T3 scope). Both are fully
supported in `mode="html"`.

---

## 13. Completion Log

| Row | Date | Task | Reviewer score | Notes |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-02 | T1 — extract AddonSlotRegistry to lib | 96 | Verbatim move to `lib/addon-slots.ts`, re-exported from host; 530 tests green. |
| 2 | 2026-07-02 | T2 — sanitizer attribute-rule API | 93 | Ref-counted `registerAttributeRules`; locked attrs rejected; companion post-pass; 70 tests green. |
| 3 | 2026-07-02 | T3 — markdown span-serializer | 93 | `registerSpanSerializer` + `toHtml` raw-tag protection; round-trip lossless; 83 tests green. |
| 4 | 2026-07-02 | T4 — addon host + toolbar slots | 93 | Host via DI (no addon import); selection/wrap/mutate/save/restore + toolbar slots; 340 tests green. |
| 5 | 2026-07-02 | T5 — addon skeleton | 93 | Types + serializer + directive registering rules/serializer/toolbar/slash; all torn down; 11 tests green. |
| 6 | 2026-07-02 | T6 — attach dialog + form + apply | 93 | Tier-1 form + picker dialog + apply (text/image/merge); fixed image capture bug; 19 tests green. |
| 7 | 2026-07-02 | T7 — tiers 2 + 3 | 92 | Dynamic form hosting (two-effect, no NG0602), external flow, precedence + non-flat reject; 24 tests green. |
| 8 | 2026-07-02 | T8 — edit popover | 92 | Caret-driven top-layer popover, remove/unwrap, edit-prefill, unknown-id, readonly gating; 30 tests green. |
| 9 | 2026-07-02 | T9 — framework-free runtime | 96 | Delegated listeners; hover/click/focus/tap-to-hover; a11y; no `@angular`; 15 tests green. |
| 10 | 2026-07-02 | T10 — render-side bind directive | 93 | `[uiRichTextActions]` wraps runtime; effect + observer re-bind; clean teardown; 47 tests green. |
| 11 | 2026-07-02 | T11 — optional presets | 92 | hover-card + open-dialog presets (top-layer, grace-area, Esc, teardown, zero-lock-in); 59 tests green. |
| 12 | 2026-07-03 | T12 — locales + RTL | 92 | en/he via `createLocaleBindings`; dialog/popover/form localized + `[attr.dir]`; 60 tests green. |
| 13 | 2026-07-03 | T13 — registry addon entry | 96 | `type:addon`/`parent`/`attach`/`requiresBaseFiles`; barrel imports keep files[] addon-only; no publish. |
| 14 | 2026-07-03 | T14 — e2e harness | 93 | `rte-actions` multi-component EXPLICIT_SPECS; 3 Playwright tests. |
| 15 | 2026-07-03 | T15 — demo + stories | 91 | 4 stories + demo page (en/he) registered; demo builds; extra gallery variants deferred. |
| 16 | 2026-07-03 | T16 — full-suite gates | 96 | 5241 tests + e2e green; demo builds; SonarQube server scan clean (10 findings fixed); no publish. |

---

## 14. v2 Enhancements — Starter Styling + Combined Actions

> **Status:** Approved design — ready for implementation planning
> **Date:** 2026-07-09
> **Author:** brainstormed with maintainer (customer request).
> Additive to v1; nothing in §1–§13 is removed or reinterpreted. Existing
> content, definitions, and serialized HTML continue to work unchanged.

### 14.1 Motivation (customer request)

Two asks from a customer already using the addon:

1. **A dev-provided "first look" for actioned text.** Today the *output HTML*
   of an actioned run is completely unstyled — the reader-facing look is the
   dev's job (CSS recipe in §4.6). The customer wants developers to seed a
   **starter visual** so actioned text looks intentional out of the box, while
   authors can still restyle it freely in the editor.
2. **A single action that wires both click *and* hover.** Today an author makes
   two attach passes to get both triggers (UC-7). The customer wants one picker
   selection that attaches both — e.g. **"Connect to dictionary"**: hover shows
   a preview of the value, click opens the full dictionary dialog with that
   value selected. One selection, two behaviors.

### 14.2 Part A — Starter styling ("rich action class")

**Model: seed inline styles at attach time (baked into content).** Chosen over
a CSS-class/stylesheet approach specifically because the output HTML must be
**self-contained** — the dev ships no extra CSS, and the styled look travels
with the HTML (design pillar #1). Authors then edit the look like any other
inline formatting.

**API additions (additive, non-breaking):**

```ts
// Directive input — the global default look for every actioned span.
readonly uiRteActionsStyle = input<Record<string, string>>({});

// RichTextActionDefinition — optional per-action override, merged OVER the global default.
export interface RichTextActionDefinition {
  // …existing…
  /** Starter inline styles seeded onto a newly-created action span. Merged over `uiRteActionsStyle`. */
  style?: Record<string, string>;
}
```

Usage:

```html
<ui-rich-text-editor
  [uiRteActions]="defs"
  [uiRteActionsStyle]="{ color:'#2563eb', textDecoration:'underline dotted', textUnderlineOffset:'3px' }" />
```

```ts
{ id:'dictionary', label:'Connect to dictionary', style:{ color:'#7c3aed' }, /* … */ }
```

**Behavior (normative):**

- **When applied:** only on **create** — i.e. when the addon wraps a brand-new
  `span` around the selection (`wrapSelection`). The merged style
  (`{ ...uiRteActionsStyle(), ...def.style }`) is written **once** via
  `span.setAttribute('style', …)` (camelCase keys → kebab CSS properties;
  canonical, deterministic ordering).
- **Never re-seeded:** adding a second trigger to an existing span (UC-7),
  editing params, or re-attaching does **not** touch `style` — author edits are
  never clobbered.
- **Editor vs output:** because it is baked content, the seed shows in **both**
  the editor and the output HTML. The hardcoded in-editor affordance (dotted
  bottom-border + faint tint, §5.4) is **unchanged** and layers on top as the
  "this is actioned" marker.
- **Author edits win:** the seed is ordinary inline style; the editor's format
  commands (color, bold, highlight, etc.) overwrite/extend it normally. The
  seed uses no `!important`.
- **Images:** the seed applies to **text spans only**. An author's `<img>` is
  never restyled (its visual is the image; the dashed-outline affordance
  already marks it). `def.style` is ignored for image targets.
- **Remove/unwrap:** when removing the last action from a span, if the span's
  current `style` attribute is **byte-identical to the seed the addon would
  have written** (recomputable from `uiRteActionsStyle()` + the removed
  action's `style`, unedited), strip `style` too so the bare span unwraps per
  §5.5. If the author changed it, keep the styled span (now their content).
- **Empty config:** `uiRteActionsStyle` defaults to `{}` and no per-action
  `style` → **zero style attribute written**; behavior is exactly v1 (fully
  backward-compatible).

**Toolbar connectivity (verified, not assumed).** Because the seed is baked as
inline style *content*, the editor's toolbar reads it exactly like
author-applied formatting — `updateActiveFormats()`
(`rich-text-editor.component.ts:5540`) drives the toggles from
`document.queryCommandState(...)`, and font size/family from `getComputedStyle`.
Measured in Chromium (Chrome 150) with a real `contenteditable`:

| Seed declaration | Toolbar effect |
| --- | --- |
| `font-weight: bold` / `700` / `600` | **Bold toggle ON** (execCommand bold-state threshold is `≥600` in Chromium) |
| `font-weight: 500` / `400` | Bold toggle **OFF** |
| `text-decoration: underline` (or `text-decoration-line`) | **Underline toggle ON** (toggling it then removes the underline — expected, it's editable content) |
| `font-style: italic` | **Italic toggle ON** |
| `text-decoration: line-through` | **Strikethrough toggle ON** |
| `font-size` / `font-family` | Size/family **dropdowns reflect it** (`getComputedStyle`) |
| `color` / `background-color` | **No reflection today** — closed by Part D (§14.9) |

The `≥600` threshold and underline behavior are browser-engine specifics; they
were verified in-browser rather than assumed. This asymmetry is *why* Part A
bakes inline style instead of using a CSS class or an addon stylesheet — with a
class, `queryCommandState` sees nothing on the selection, so visibly-bold text
would read **Bold: off** and clicking Bold would stack a second bold layer.

**Affordance vs seed (no collision).** The in-editor affordance (§5.4)
deliberately uses `border-bottom`, never `text-decoration: underline`, so it
never fights the Underline toggle. A dev *seed* that includes
`text-decoration: underline` is fine and reads as a normal, toggleable
underline — the non-editable affordance and the editable seed coexist.

### 14.3 Part B — Combined action (one selection → click + hover)

**API additions (additive):**

```ts
export type ActionParamsMode = 'shared' | 'separate';

export interface RichTextActionDefinition {
  // …existing…
  /** Attach BOTH click and hover in one picker selection. Requires `triggers` to include both. */
  combined?: boolean;
  /** Combined only. 'shared' (default): one form → identical params on both triggers.
   *  'separate': per-trigger fields from `fieldsByTrigger`. */
  paramsMode?: ActionParamsMode;
  /** Combined + paramsMode:'separate' — tier-1 fields per trigger. */
  fieldsByTrigger?: { click?: RichTextActionField[]; hover?: RichTextActionField[] };
}
```

```ts
{
  id: 'dictionary', label: 'Connect to dictionary', icon: 'book',
  triggers: ['click', 'hover'], combined: true, paramsMode: 'shared',
  fields: [{ key:'value', label:'Dictionary value', type:'select', required:true, options:[…] }],
}
```

**Serialization** (same id on both triggers; §3 format unchanged):

```html
<span
  style="color:#7c3aed;text-decoration:underline dotted"
  data-action-click="dictionary"  data-action-click-params='{"value":"sla"}'
  data-action-hover="dictionary"  data-action-hover-params='{"value":"sla"}'
>SLA</span>
```

`paramsMode:'separate'` writes different `-click-params` / `-hover-params`.

**Behavior (normative):**

- `combined:true` is **explicit opt-in.** Existing definitions with
  `triggers:['click','hover']` and no `combined` keep v1's "pick one trigger"
  radio (§5.2) — no behavior change.
- **Precedence guard:** `combined` requires both triggers; a dev-mode
  `console.error` fires (like the multi-tier warning, §4.1) if `combined:true`
  with fewer than two triggers, and the action falls back to single-trigger.
- **Params tiers under combined:**
  - `paramsMode:'shared'` (default) — the existing tiers (`fields` /
    `formComponent` / `resolveParams`) run **once**; the resolved params object
    is written to **both** trigger attributes.
  - `paramsMode:'separate'` — **tier-1 only** for v1 (`fieldsByTrigger`). The
    dialog renders two labelled field groups (Hover / Click); each produces its
    own params object. `formComponent` / `resolveParams` under `'separate'` is
    out of scope for v1 (dev-mode `console.error`, falls back to `'shared'`).
- **Attach:** one `wrapSelection` creates one span; the addon writes both
  trigger attrs (+ per-mode params) + the starter seed (§14.2) in a single
  `mutateContent` transaction (one undo entry restores the pristine text).

**Authoring UX changes (§5 additions):**

- **Picker (§5.2):** a combined action renders as **one** row with a
  `click + hover` badge; selecting it shows **no** trigger radio. The "occupied
  trigger → Replace" logic (§5.2) treats a combined attach as occupying both
  triggers.
- **Edit popover (§5.5):** a combined action renders as **one** row
  (`📖 Connect to dictionary · click + hover  ✎ 🗑`). ✎ reopens the combined
  form (both triggers/params); 🗑 removes **both** trigger attributes together
  (then unwrap per §14.2). Two *separate* single-trigger actions on one span
  (v1 UC-7) still render as two rows — the popover distinguishes them by
  whether both attrs carry the same combined-capable id.

**Runtime (§4.4): unchanged.** The delegated listeners already deliver
`event.trigger`. A single handler keyed on the combined id branches:

```ts
handlers = {
  dictionary: (e) => e.trigger === 'hover' ? showPreview(e) : openFullDialog(e),
};
```

### 14.4 Part C — Combined preset (the dictionary example, batteries-included)

A new preset composing the two existing presets into one combined action —
lives in `presets/` alongside hover-card & open-dialog, imports neither the
core nor Angular beyond what the existing presets already use.

```ts
// presets/linked-preview-dialog.preset.ts
export interface LinkedPreviewDialogOptions {
  id?: string;            // default 'preset.linked-preview-dialog'
  label?: string;         // default 'Preview + dialog'
  paramsMode?: ActionParamsMode;   // default 'shared'
  extraFields?: RichTextActionField[];
  hover?: HoverCardPresetOptions;      // forwarded to hover-card rendering
  dialog?: OpenDialogPresetOptions;    // forwarded to open-dialog rendering
}
export function linkedPreviewDialogAction(o?: LinkedPreviewDialogOptions): RichTextActionDefinition; // combined:true
export function linkedPreviewDialogHandlers(injector: Injector, o?: LinkedPreviewDialogOptions):
  Record<string, RichTextActionHandler>;   // hover→card, click→dialog, keyed on the single id
```

Quick start:

```ts
readonly defs = [ linkedPreviewDialogAction() ];
readonly handlers = { ...linkedPreviewDialogHandlers(this.injector) };
```

- The returned definition is `combined:true`, `triggers:['click','hover']`,
  tier-1 fields (`title`/`body` for the hover card + `title`/`body`/
  `confirmLabel` for the dialog, or a shared set under `paramsMode:'shared'`).
- The returned handler map is a **single** `{ [id]: handler }` whose handler
  branches on `event.trigger` — hover start/end drives the top-layer preview
  card (reusing the hover-card grace-area/Esc logic), click opens the modal
  (reusing the open-dialog logic).
- **Zero lock-in** still provable: the serialized HTML carries only the id +
  params + seeded style; a hand-written replacement handler drives the same
  content unchanged.

### 14.5 Serialization & security — no changes

The v1 format (§3) and sanitizer contract (§7.3) are untouched. `style` is
**not** a new addon-contributed attribute — the base sanitizer's existing
handling of `style` on allowed elements governs it (the seed uses only safe
declarations). The addon must **not** call `registerAttributeRules` for
`style` (§7.3 hard-rejects it anyway). If the base sanitizer strips inline
`style`, T-A1 begins with a discovery spec (zero-assumptions rule) and the seed
falls back to a documented limitation rather than widening the security
boundary.

**T-A1 discovery finding (2026-07-09):** confirmed **kept**. On a `<span>`
carrying `data-action-click`/`data-action-click-params` (registered via
`registerAttributeRules`, as the addon does in production) plus
`style="color:#2563eb;text-decoration:underline dotted"`, `sanitize()`
preserves the inline `style` unchanged — it is already covered by the
pre-existing global `style` entry in `ALLOWED_ATTRS['*']`, independent of the
action attributes. No sanitizer change needed; Part A's seeded-style design is
unblocked. See
`packages/components/ui/rich-text-editor/rich-text-sanitizer.service.spec.ts`
("preserves a safe inline style on an action span (v2 starter-style
discovery)"). Note: the `data-action-*` attributes themselves only survive
when the addon has registered its attribute rules — that requirement is
existing, expected behavior (§7.3), not new information from this test.

### 14.6 Test plan additions

Serializer / definition:

- **68.** `def.style` merges over `uiRteActionsStyle`; per-action wins on key clash.
- **69.** seed written only on create; not on add-second-trigger / edit / re-attach.
- **70.** remove-last-action strips an **unedited** seed and unwraps; keeps an **edited** style.
- **71.** empty style config writes no `style` attribute (v1 parity).
- **72.** image target ignores `style` seed.
- **73.** `combined:true` writes both trigger attrs with the same id in one transaction (one undo).
- **74.** `paramsMode:'shared'` writes identical params to both; `'separate'` writes per-trigger params.
- **75.** `combined:true` with <2 triggers → dev-error + single-trigger fallback.
- **76.** `paramsMode:'separate'` with formComponent/resolveParams → dev-error + shared fallback.

Authoring UI:

- **77.** combined action → single picker row, no trigger radio; attach writes both + seed.
- **78.** edit popover shows combined as one row; 🗑 removes both triggers; ✎ reopens combined form.
- **79.** v1 two-separate-actions on one span still render as two rows (regression).

Sanitizer / base (discovery):

- **80.** base sanitizer preserves a safe inline `style` on an action span (discovery spec for T-A1).

Presets:

- **81.** `linkedPreviewDialogAction()` returns `combined:true` with both triggers + fields.
- **82.** `linkedPreviewDialogHandlers()`: hover renders preview card (start/end); click opens dialog; both from one id.
- **83.** zero lock-in: serialized HTML for the combined preset carries only id/params/seed style.

E2E (extend the existing `rte-actions` EXPLICIT_SPECS entry):

- **84.** author attaches the combined dictionary action; published pane: hover shows preview, click opens dialog.
- **85.** seeded style is present in `htmlChange` output and survives the storage→renderer round trip.

Suite gates unchanged (§10.10): `npm run test-visual` green, e2e impact subset
green, **`npm run coverage` → `npm run sonar` against `localhost:9000` clean on
changed files** (mandatory done gate), `sync-registry` no warnings.

### 14.7 Implementation task list (v2)

Rules unchanged: TDD per task; per-task review-gate ≥95; compile + relevant
specs green before advancing; zero-assumption verification.

| # | Task | Scope | Key deliverables | Depends on |
| --- | --- | --- | --- | --- |
| T-A1 | Base discovery: does the sanitizer keep safe inline `style` on action spans? | base | test 80 FIRST; documented finding; no security-boundary widening | — |
| T-A2 | Starter styling: `uiRteActionsStyle` input + `def.style`, seed-on-create, remove/unwrap, image skip | addon | tests 68–72; §14.2 | T-A1 |
| T-B1 | Types: `combined`, `paramsMode`, `fieldsByTrigger`, `ActionParamsMode`; guards + fallbacks | addon | tests 73–76 (write path) | — |
| T-B2 | Dialog: single row + no radio for combined; shared/separate param forms; one-transaction attach | addon | tests 77 | T-B1, T-A2 |
| T-B3 | Edit popover: combined single row; remove-both; edit reopen; v1 two-row regression | addon | tests 78–79 | T-B2 |
| T-C1 | Preset `linked-preview-dialog` (action + handlers), overlay reuse | addon | tests 81–83 | T-B2 |
| T-D1 | Locales/RTL/touch pass for new dialog sections + preset; demo section + story | demo | RTL + viewport checks | T-B3, T-C1 |
| T-D2 | E2E extend `rte-actions`; registry `sync-registry --fix` (new preset file); publish-boundary re-verify | e2e/tooling | tests 84–85; zero warnings; confirm no publish | T-C1 |
| T-D3 | Full-suite gates (§10.10) incl. SonarQube server scan; Completion Log update | all | green evidence pasted into log | all |

**Publish boundary:** addon component/lib source + registry `files[]` data only
→ served live from master, **no CLI publish** (no `ComponentDefinition` shape
change). T-D2 re-verifies against `packages/cli/src/registry/load.ts` before
asserting.

### 14.8 Completion Log (v2)

| Row | Date | Task | Reviewer score | Notes |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-09 | T-A1 discovery — sanitizer keeps inline style on action spans | 96/100 | Style is unconditionally allowed via `ALLOWED_ATTRS['*']`, applied before contributed-rule logic, so it survives regardless of `data-action-*` registration; test registers `idRule`/`paramsRule` (mirroring real addon usage in `rich-text-actions.directive.ts`) to correctly isolate the style question. Full sanitizer suite 71/71 green. |

### 14.9 Part D — Color-picker upgrade + fore/background reflection

> **Scope note (read first):** this is a **base editor** change
> (`rich-text-editor`), *not* addon-scoped — it affects every editor consumer,
> not only those using the actions addon. It is included here because it closes
> the color half of the toolbar-connectivity story (§14.2): a dev-seeded
> `color`/`background-color` currently reflects nowhere. The upgrade is a
> general editor improvement that happens to complete Part A.

**Problem.** The toolbar's Text Color / Background Color controls are fixed
swatch grids, and — unlike bold or font-size — the current selection's color is
never read back. So an author (or a Part A seed) that sets `color`/
`background-color` gets no active indication, and users can only pick from the
preset swatches, not an arbitrary color.

**Solution.** Replace the two swatch grids with the library's existing
`ui-color-picker` (arbitrary color across hex/rgb/hsl/oklch, eyedropper,
recents, WCAG contrast), **keeping the current swatches as quick-selects**, and
read the selection's computed color back into the picker so seeded/author colors
reflect.

**API & wiring (base):**

- The `fontColor` / `backgroundColor` toolbar popovers host
  `<ui-color-picker>` instead of the raw swatch `@for` grids:
  - `[presets]="textPalette"` / `[presets]="highlightPalette"` — the existing
    palettes become the picker's quick-select swatches (no muscle-memory loss).
  - Background picker `[alpha]="true"` (highlights need transparency); text
    picker keeps alpha off.
  - `(colorChange)="onColorSelect('fontColor' | 'backgroundColor', $event)"` —
    the existing apply path (`foreColor`, and `hiliteColor`→`backColor`
    fallback, plus mention-style sync) is **unchanged**.
  - Value bound to new `currentFontColor` / `currentBackgroundColor` signals.
  - Sensible defaults only: eyedropper on (its default), harmonies off (keep
    the popover compact); `formats` left at the component default.
- New `detectCurrentColors()` in `RichTextEditorComponent`, called from
  `updateActiveFormats()` alongside `detectCurrentFontSize()` /
  `detectCurrentFontFamily()`: reads `getComputedStyle(el).color` /
  `.backgroundColor`, normalizes (`rgb()`→hex; `rgba(…,0)` / `transparent` →
  "none"), and sets the two signals. This is what makes a Part A seed — and any
  author-applied color — show as the picker's current value/active swatch.

**Compatibility.** Quick-select swatches remain, so existing color specs that
click a swatch keep working (selector updates only where the swatch DOM now
lives inside the picker). Adds `color-picker` to the `rich-text-editor` registry
`dependencies`. Component/lib source + registry **data** → served live from
master, **no CLI publish** (re-verify in T-E3).

**Test plan additions (extend §14.6):**

- **86.** `fontColor` popover renders `ui-color-picker` with `textPalette`
  presets; picking a preset still calls `onColorSelect('fontColor', …)`.
- **87.** an arbitrary (non-palette) color is choosable and applied via `foreColor`.
- **88.** `backgroundColor` picker applies `hiliteColor`/`backColor`; alpha /
  `transparent` handled.
- **89.** `detectCurrentColors()` reflects the selection's computed color into
  the picker value (a seeded `color` shows as current).
- **90.** a seeded `background-color` reflects in the background picker;
  `transparent` → "none"/no active swatch.
- **91.** regression: existing color specs (swatch click, mention-color sync)
  still pass.

**Task list additions (extend §14.7):**

| # | Task | Scope | Key deliverables | Depends on |
| --- | --- | --- | --- | --- |
| T-E1 | Swap swatch grids → `ui-color-picker` in both color popovers (`presets` = current palettes; `alpha` for bg); wire `colorChange` → `onColorSelect` | base | tests 86–88 | — |
| T-E2 | `detectCurrentColors()` in `updateActiveFormats()`; bind `currentFontColor`/`currentBackgroundColor` into the pickers | base | tests 89–90 | T-E1 |
| T-E3 | Registry: add `color-picker` to `rich-text-editor` deps (`sync-registry --fix`); regression + RTL/touch/density pass; publish-boundary re-verify | tooling/base | test 91; no publish | T-E1 |

Part D is independent of Parts A–C and can land on its own track; Part A's
`color`/`background-color` seeds simply gain a reflecting control once it ships.
