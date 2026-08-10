# Code Review — `rich-text-editor`

**Date:** 2026-08-09 (fixes applied 2026-08-10) · **Scope:**
`packages/components/ui/rich-text-editor/**` (95 non-spec source files).

**Applied so far — Tier 0 and Tier 1 only.** The live defect below is fixed, the
mojibake is gone, and the comment purge is done. **Tiers 2–4 remain
recommendations; no structural or API change has been made.** Each applied item
is marked ✅ inline.

Reviewed against four criteria:

1. **Cleanliness** — clear inputs/outputs, no inline comments, all types well
   defined *and exported*
2. **Easy to use and modify** by consuming devs
3. **Easy to read and understand**
4. **Not unnecessarily abstracted**

Because this is a shadcn-style library, **the source is copied into the
consumer's project**. "Can an ordinary dev read and modify this file" therefore
outranks internal elegance throughout.

---

## Verdict

**The architecture is sound.** It is the house pattern — `*.host.ts` abstract
contract + `addons/` + the shared `lib/addon-slots.ts` registry — the same design
`data-table` uses. The base never imports an addon, features are opt-in attribute
directives, and tree-shaking is automatic. None of that needs changing.

The real problems are narrower and all fixable:

- **One live user-visible bug** shipping today (below).
- **Repetition the pattern never factored out** — a 3-line helper copy-pasted 10×,
  a class string triplicated, 9 near-identical DI-token files.
- **Three parallel toolbar-extension APIs**, one of which is dead weight that
  *renames* capabilities the host already exposes.
- **A 4,197-line component** — though a notably well-ordered one, which changes
  what the right fix is.

Roughly 75 of the 95 source files are already clean and need nothing.

---

## 🔴 Ship-now defect — ✅ FIXED

**`rich-text-editor.component.ts:4091`** — inside `buildHistoryPreview()`:

```ts
.replaceAll(/<li[^>]*>/gi, 'ג€¢ ');   // U+05D2 U+20AC U+00A2 — should be '• '
```

The bullet character is double-encoded UTF-8. **Every list item in the history
addon's revision panel renders as `ג€¢` to end users right now.** Two-character
fix; nothing else depends on it.

This is one symptom of a wider encoding problem in that file — 409 mojibake
characters total, distributed as:

| Location | Count | Action |
|---|---|---|
| Banner comments (`// ── Toolbar ───`) | 395 | Deleted anyway by the comment purge — don't fix separately |
| JSDoc (lines 67, 68, 75, 76, 77, 84, 86, 95, 96, 97, 249, 266, 322) | 13 | Fix — this JSDoc **ships to consumers** |
| Code (`:4091`) | 1 | Fix — live bug |

Two traps for whoever fixes it:

- **Do not whole-file transcode.** The file also contains **12 correct** `—`
  (U+2014) at lines 308, 341, 992, 1442, 1456, 1489, 1649, 3443, 3444, 3518,
  3532, 3540. A blanket cp1255→UTF-8 re-decode destroys them. Replace the three
  specific triplets (`ג€”`, `ג”€`, `ג€¢`) only.
- The file carries a **UTF-8 BOM** at byte 0; strip it while you're there.

**Scope was exactly this one file.** Searching the precise signature
`rg 'ג€|ג”|Ã¢|â€'` across `ui/` and `lib/` matched nothing else. (A naive `ג`
search returns 39 files — those are legitimate Hebrew in `*.locales.ts`, not
mojibake. Worth knowing before anyone runs a bulk fix.)

**✅ Fixed.** The bullet and the 13 JSDoc em dashes were repaired by targeted
triplet replacement, the BOM stripped, and the 395 banner occurrences removed
with the banners themselves. The 12 correct `—` survived. **Library-wide mojibake
is now 0.** A regression test (`marks list items in history previews with a real
bullet character`) was verified to fail without the fix.

---

## Criterion 1 — Cleanliness

### ✅ What passes

- **Zero `any`.** Not one occurrence in 95 source files. (Library-wide there are
  only 2 non-spec files with `any` at all.)
- **Addon directives are ~100% JSDoc'd** on inputs and outputs — `mentions`,
  `file-import`, `colors`, `typography`, `links`, `ai`, `outline`, `tables`,
  `history`, `emoji`, `images`, `slash-commands` are all complete.
- The `host.ts` contract has **unusually good documentation** — every one of its
  ~30 members explains not just what but *why*, including known edge cases.

### ❌ Inline comments — 226 `//` + 2 block, across 19 files

Counts are from `node scripts/review-audit.mjs --component rich-text-editor`, which
reads the parser's comment ranges. Don't count these with grep — `//` matches
`https://` and string contents, and a raw `ts.createScanner` under-counts because
it can't tell regex-start from divide in these regex-heavy files.

| File | `//` | Notes |
|---|---|---|
| `rich-text-editor.component.ts` | 49 | 9 are banner separators |
| `rich-text-markdown.service.ts` | 38 | |
| `rich-text-sanitizer.service.ts` | 38 | |
| `rich-text-paste-normalizer.service.ts` | 21 | |
| `addons/slash-commands/rich-text-slash-commands.directive.ts` | 20 | |
| `addons/actions/rich-text-actions.directive.ts` | 8 | |
| `addons/ai/rich-text-ai.directive.ts` | 8 | |
| `addons/images/rich-text-images.directive.ts` | 7 | +2 block, `{ /* … */ }` no-op bodies |
| `addons/outline/…` 6, `addons/colors/…-button` 5, `addons/mentions/…` 5 | 5–6 | |
| `addons/colors/…` 4, `addons/file-import/…` 4, `host.ts` 4, `addons/links/…` 3 | 3–4 | |
| 4 tail files | 1–2 each | |
| **~76 other source files** | **0** | already clean |

For scale: **RTE holds 226 of the library's 467 non-JSDoc comments — 48% of them,
in one component.**

> **Status: DONE.** 226 → **20**, across 6 files. 66 banner lines deleted, ~60
> narration lines deleted, and the rest promoted into JSDoc on the declaration
> or method that owns them. The remaining 20 are deliberate keeps:
>
> | Count | Where | Why kept |
> |---|---|---|
> | 13 | `rich-text-sanitizer.service.ts` allowlist arrays | Group labels (`// Inline elements`, `// Longhand border properties (Word paste uses these)`) on a security allowlist. They label *data rows*, not code, and several carry the *why* — `'border-width'` alone doesn't tell you Word paste needs it. |
> | 3 | `rich-text-editor.component.ts` class-list array | Same: labels on a 60-line Tailwind `[&_x]:` list. `'[&_ul_ul]:my-0 [&_ol_ol]:my-0'` is not self-documenting. |
> | 3 | `presets/open-dialog.preset.ts`, `presets/hover-card.preset.ts` | Inside anonymous callbacks with no JSDoc slot; a doc block on the enclosing preset function would bury the point far from the code. |
> | 1 | `rich-text-markdown.service.ts` | Trailing note explaining magic arithmetic (`position + 4 + lang.length + 1`). |
> | 1 | `addons/full/index.ts` | Auto-generated header; `sync-registry` would regenerate it. |
>
> A stricter reading of "no inline comments" would delete the 16 data labels too.
> That is a one-line change if wanted, but it trades measurable readability on
> opaque data for rule purity — flagged rather than decided unilaterally.

**Don't strip these blindly.** They fall into three buckets needing three
different actions:

1. **Banner separators** (`// ── Toolbar ─────`) — delete. 9 in the component,
   5 in `host.ts`.
2. **Narration** ("increment the counter") — delete. The large majority.
3. **Load-bearing rationale — promote to JSDoc, do not delete.** These exist and
   are worth real money. Example: `component.ts:1489` records the *root cause of
   a fixed defect* ("the reported de-selects-and-stops-changing bug"). Deleting
   that invites the regression back. Budget ~10–15 promotions; the sanitizer and
   paste-normalizer hold the most, because their comments document specific
   browser and Excel quirks that are not inferable from the code.

### ❌ ~90 public members lack JSDoc

| File | Missing |
|---|---|
| `rich-text-editor.component.ts` | 51 / 75 methods |
| `sub/rich-text-toolbar.component.ts` | **24 / 24** — all 12 inputs *and* all 12 methods |
| `rich-text-command-registry.service.ts` | 5 / 5 |
| `addons/images/rich-text-images-overlay.component.ts` | 16 / 16 inputs |
| `addons/mentions/rich-text-mention-popover.component.ts` | 7 inputs, 6 methods |
| `addons/actions/` dialog / form / popover | 6 / 6, 5 / 6, 6 / 6 |
| `addons/images/rich-text-images-resizer.component.ts` | 6 / 11 |

**The pattern is informative:** feature directives were documented; `sub/`,
overlays, presets and the core were not. It's a coverage gap, not a culture gap.

**Important context from the library-wide sweep:** RTE's input/output JSDoc
coverage is **64%**, against a library average of **16%**. Its public-method
coverage is **42%** against **13%**. On documentation, RTE is one of the *best*
components in the repo, not one of the worst — so Rec 4 is a polish item here,
while the same problem is a systemic emergency elsewhere. See
[`library-review.md`](./library-review.md).

### ❌ ~98 never-reassigned members missing `readonly` (S2933)

63 are in the main component — every one of its 26 inputs/outputs (`:212-334`)
plus most signals (`:344-425`). Every addon directive already does this correctly.

Two notes for whoever fixes it:

- **Genuinely mutable — leave alone:** `tableContextMenuTarget`,
  `tableContextMenuCloseHandler`, `tableCellSelecting`, `tableCellSelectAnchor`,
  `findHighlightElements`, `history`, `historyIndex`, `isUndoRedo`,
  `historyDebounceTimer`, `shortcutHandle`, `savedRange`, `linkEditorOpen`,
  `onChange`, `onTouched`, `autoUploadCounter`, `caretColorAnchor`.
- **Cosmetic wart incoming:** the toolbar has a member named `readonly`
  (`sub/rich-text-toolbar.component.ts:171`), so the fix produces
  `readonly readonly = input<boolean>(false)`. Valid TypeScript, reads badly —
  add a JSDoc line above it so the next reader isn't startled.

This category is self-checking: the compiler rejects a wrong `readonly`.

### ❌ 13 types declared but not exported

The criterion is "well defined **and exported**". These are well defined but
module-private:

| Type | Location |
|---|---|
| `HistoryEntry`, `SerializedSelection` | `rich-text-editor.component.ts:119, 130` |
| `ListType`, `ListContext`, `ParsedListLine` | `rich-text-markdown.service.ts:13, 15, 22` |
| `ToolbarButton` | `sub/rich-text-toolbar.component.ts:83` |
| `ApplyTarget` | `addons/actions/rich-text-actions.directive.ts:513` |
| `ResizeHandle`, `ResizeState` | `addons/images/rich-text-images-resizer.component.ts:26, 28` |
| `AutoUploadPending` | `addons/images/rich-text-images.directive.ts:69` |
| `OverlayAnchorRect` | `addons/links/rich-text-links.directive.ts:30` |
| `NormalizedSlashCommands` | `addons/slash-commands/rich-text-slash-commands.directive.ts:402` |
| `HistoryListType` | `addons/history/rich-text-history-panel.component.ts:27` |

A further 24 types *are* exported but live in implementation files rather than a
`.types.ts` — see the "consolidation is mostly not worth it" note under
Recommendations.

### ❌ Barrel gaps

- **The root `index.ts` is 8 lines and exports no addon at all.** Consequence:
  the demo carries 12 lines of deep relative imports
  (`demo/src/app/demos/inputs/rich-text-editor-demo.component.ts:15-27`), each
  `.../rich-text-editor/addons/<name>`. A consumer who copied the source has to
  learn the folder layout to use a feature.
- `packages/components/ui/rich-text-security.spec.ts` **deep-imports**
  `./rich-text-editor/rich-text-sanitizer.service` instead of the barrel —
  `sync-registry.ts` flags this class of import as a warning.

> **Corrected during review:** an earlier pass flagged `addons/history/index.ts`
> as incomplete. It is not — it exports the directive, the panel component *and*
> the locales. No addon barrel has a gap.

---

## Criterion 2 — Easy to use and modify

### ✅ Ease of use is genuinely good

Basic usage is one line:

```html
<ui-rich-text-editor mode="markdown" toolbar="top"
  [(ngModel)]="content" (htmlChange)="html = $event" />
```

Features are opt-in **attribute directives** — `uiRteEmoji uiRteSlashCommands
uiRteColors uiRteLinks uiRteTables`. No registries to import, no config object,
and because the base never imports an addon, tree-shaking is automatic. There is
an `uiRteFull` / `RTE_FULL` escape hatch for "everything on". The API is 20 inputs
/ 6 outputs, well named, and `ToolbarItem` is a documented string union so
autocomplete works.

### ✅ Adding an *addon* toolbar button — ~1 file

`host.toolbarSlots.register({...})` inside an `effect` with `onCleanup`
(`addons/tables/rich-text-tables.directive.ts:72-80`). `AddonSlotRegistry` is 19
lines — a signal array plus a teardown closure. Nothing hidden. Copy `emoji/` and
change three strings.

### ✅ Changing how a command executes — obvious

`onFormatCommand:1119` → `executeFormatCommand:1132`, a plain four-way split over
`executeInline/Block/Align/ListFormatCommand`. Switches on string literals,
direct `execCommand` calls. No dispatcher, no registry, no indirection.

### ✅ Swapping a sub-feature — easy

Remove the directive from `imports` and the attribute from the template. The base
ships *no link UI*: `showLinkDialog` forwards to whatever registered via
`registerLinkEditor` and is inert otherwise (`host.ts:254-270`). Same for images
via `registerImageFileHandler`.

### ❌ Adding a *built-in* toolbar button — 6+ edits across 4 files, failing silently

| Edit | Location |
|---|---|
| Union member | `sub/rich-text-toolbar.component.ts:57-81` |
| Label + shortcut row | `sub/rich-text-toolbar.component.ts:90` (`TOOLBAR_BUTTONS`) |
| Inline SVG | `sub/rich-text-toolbar.component.ts:116` (`ICONS`) |
| Default layout | `rich-text-editor.component.ts:141` |
| Execute case | one of four switches — `component.ts:1140 / 1170 / 1185 / 1201` |
| 10 locale dictionaries | `rich-text-locales.ts:79, 149, 220, 291, 361, 431, 501, 571, 641, 711` |

Miss any one and **nothing tells you**: `getIcon` returns `''`
(`sub/rich-text-toolbar.component.ts:261`) and `getTooltip` returns the raw id
(`:273`). You get a blank button with a machine-name tooltip and no error.

The gap between this and the addon path (1 file) is the sharpest DX inconsistency
in the component.

### ⚠️ Two smaller friction points

- Addon locale resolution deliberately does **not** follow the editor's own
  `[locale]` input (documented at `addons/emoji/rich-text-emoji.directive.ts:35-38`).
  Defensible, but it means two locale systems in one component.
- Nested editors: `globalCommands` uses `inject(…, { skipSelf: true })`, so an
  editor nested inside another editor's projected content resolves the **outer
  editor** as its "global" registry. The source documents the footgun
  (`host.ts:126-130`) but cannot prevent it.

---

## Criterion 3 — Easy to read

### The 4,197-line component — and why the obvious fix is the wrong one

`rich-text-editor.component.ts` is **4,197 lines / ~840 members**, owning: CVA,
markdown round-trip, sanitization orchestration, history (deltas / keyframes /
serialized selection), find & replace, drag-drop, block transforms, list
indent/outdent, all 17 table-editing methods, floating-toolbar positioning,
shortcut binding, context menu, touch handling, *and* the addon-host
implementation.

**But it is a well-ordered god file**, and that changes the right remedy. Methods
and state are already in contiguous, non-interleaved blocks:

| Concern | Methods | State |
|---|---|---|
| Table editing | 1675–2756 | 369–394 (26 fields) |
| Task list / list indent | 2757–2907 | — |
| Find & replace | 2921–3104 | 401–408 (8 fields) |
| History | 3804–4180 | 397–399, 410–413 |

A dependency analysis of the 45 helper methods inside those blocks — extracting
every `this.X` reference per body — found:

- **25 of 45 don't reference `this` at all.** They are already pure functions
  wearing a method costume.
- **17 more** reference `this` only to call siblings in the same group.
- **Exactly 3** have real external dependencies: `splitCellsInRow → this.document`,
  `buildHistoryPreview → this.sanitizer`, `getListDepth`/`findAncestorByTag →
  `this.editorDiv`.

**So 615 lines across 41 functions can move to module scope by cut-and-paste**,
threading one extra parameter in three places. No port interface, no service, no
DI. That is the extraction worth doing (Rec 12).

### Other size observations

- `rich-text-paste-normalizer.service.ts` — 1,402 lines, 2,328-line spec.
- `rich-text-editor.component.spec.ts` — **6,291 lines in one file.**
- Cognitive-complexity candidates (length + nesting): `actions-runtime.ts:110`
  `paramsFor` (67 lines), `component.ts:1436` `applySelectionColor` (~65),
  `markdown:715` `applyFormat` (54), `sanitizer:290` `sanitizeImageSrc` (52),
  `sanitizer:428` `applyAllowedAttribute` (51), `component.ts:1245`
  `onFloatingFormatCommand` (50), `normalizer:890` `normalizeExcel` (49),
  `component.ts:3941` `pushHistory` (48).
- Nesting ≥5 levels appears in **only 3 files** — the component, the normalizer,
  the sanitizer. Everything else stays ≤4.

---

## Criterion 4 — Unnecessary abstraction

### A. Three parallel toolbar-extension APIs — in one 311-line file

| Mechanism | Input | Output |
|---|---|---|
| Built-in | `items` (`:159`) | `formatCommand` (`:174`) |
| **Custom** | `customItems` (`:175`) | `customItemClick` (`:176`) |
| Addon slot | `addonSlots` (`:177`) | `addonSlotClick` (`:178`) |

The middle one is dead weight. `RichTextCustomToolbarItem`
(`component.ts:103`) is strictly weaker than a `RichTextToolbarSlot` — no
`isEnabled`, no component slot — and its callback receives a bespoke 5-method
**`RichTextEditorRef` wrapper** (`component.ts:111-117`) that *renames*
capabilities the host already has:

| `RichTextEditorRef` | Already exists as |
|---|---|
| `insertText` | `host.insertTextAtCaret` |
| `insertHtml` | `host.insertHtmlAtCaret` |
| `getSelectedText` | `host.selection().text` |
| `getHtmlContent` | `htmlOutput()` |
| `focus` | focus `host.contentRoot` |

Two names for one capability, with nothing marking which is canonical — the
textbook version of "unnecessarily abstracted".

**Blast radius verified:** searching the whole repo for
`customToolbarItems|RichTextCustomToolbarItem|RichTextEditorRef|customToolbarAction|customItemClick|customItems`
returns hits **only** inside the RTE folder's own definition/spec/story files,
plus one historical planning doc. **Zero usages in `demo/` (which has 3 RTE demo
components), zero in e2e, zero in docs.** Nobody uses it.

### B. Nine `*.context.ts` DI-token files

`addons/{ai,colors,emoji,file-import,images,links,outline,tables,typography}/*.context.ts`.
Each exists solely to hand 2–3 closures from a directive to its own button
component, with a byte-identical manual `Injector.create` at
`addons/emoji/rich-text-emoji.directive.ts:72-75` and
`addons/tables/rich-text-tables.directive.ts:68-71`.

Worse, **7 of them carry a tautological spec** whose only assertion is
`expect(TOKEN).toBeInstanceOf(InjectionToken)` — `colors`, `emoji`, `links`, `ai`,
`outline`, `images`, `file-import`. Those test the Angular framework, not this
code, and they **inflate the coverage figure the SonarQube gate consumes**.

### C. A DI hierarchy to pass one boolean

`slotInjectorCache` — a `WeakMap` plus `slotInjector()`
(`sub/rich-text-toolbar.component.ts:192-203`) — exists to layer
`RichTextToolbarViewContext` onto the slot's injector. That abstract class has
**exactly one member**: `compact: Signal<boolean>` (`host.ts:43-46`).

### D. Speculative generality, shipped

`builtinCommands` (`host.ts:271-277`, `component.ts:306-313`) is an abstract
member on the addon contract documented in-source as *"Currently empty — the seam
is kept so the base can reclaim a built-in command later"*. It ships as
`computed(() => [])`.

### E. The host seam is 8 `register*` hooks wide

`registerKeydownInterceptor`, `registerPasteInterceptor`, `registerDropInterceptor`,
`registerDropZonePredicate`, `registerImageFileHandler`, `registerInputObserver`,
`registerLinkEditor`, `registerShortcutAction` (`host.ts:184-316`). Each is
individually justified and the docs are excellent — but a copy-paste consumer must
absorb a 317-line interface before touching anything. Noted as a cost, not a
defect; no cheaper design is obvious.

### Under-abstraction — the flip side

- **`coerceEnabled` copy-pasted verbatim 10×** — an identical 3-line body at
  `colors:276`, `links:341`, `emoji:89`, `typography:214`, `history:108`,
  `outline:45`, `images:622`, `file-import:318`, `mentions:281`, `tables:92`.
  This is the one thing that unambiguously belongs in `lib/`.
- **The button class string is triplicated** — `buttonClasses:217`,
  `addonButtonClasses:229`, `customButtonClasses:296` share five identical `cn()`
  lines and differ only in how `active` is computed.

### ✅ Explicitly *not* a finding — the table seam

An earlier pass flagged that table *insert* lives in `addons/tables` (102 lines)
while table *editing* lives in the base, calling it "a seam through the middle of
one feature". **That is wrong, and the decision is deliberate and documented** in
`e2e/orchestrator/specs.ts`: *"picking a size inserts a table — the base ships no
table-insert UI (editing an existing table stays in the base)"*.

Insert-UI vs edit-behaviour is a coherent line: you can paste a table from Word
into a base editor and still edit it without installing an addon. Moving the
1,080 lines of editing into the opt-in addon would **silently remove that
capability from every base install**. Recorded here so it isn't "fixed" later.

---

## Scale context

| Component | Lines (.ts) | Files |
|---|---|---|
| **rich-text-editor** | **42,175** | **168** |
| data-table | 20,559 | 41 |
| kanban | 4,237 | 12 |
| sortable | 3,940 | 11 |
| file-viewer | 3,466 | 4 |
| *median component* | ~1,300 | ~8 |

2× data-table, 32× the median. About half is test code, so non-spec source is
~20,600 lines — still the largest by a wide margin.

**Architecturally it is not an outlier.** `data-table` uses the same host +
`addons/` layout and shares `AddonSlotRegistry`. RTE simply has 13 addons to
data-table's 3, at 5–9 files each (`actions/` alone is 16 non-spec files with its
own preset system, serializer, and framework-free runtime).

---

## Recommendations

Ordered by value ÷ risk. Every item is independently shippable.

### Tier 0 — live defect — ✅ DONE

| # | Action | Files | Risk | Breaking | Status |
|---|---|---|---|---|---|
| 1 | Fix `:4091` `'ג€¢ '` → `'• '`; fix the 13 JSDoc mojibake; strip the BOM. **Targeted triplet replacement only** — a whole-file transcode destroys the 12 correct `—`. | `component.ts` | Very low | No | ✅ **done**, regression-tested |

### Tier 1 — mechanical, compiler-proven, non-breaking

| # | Action | Risk | Status |
|---|---|---|---|
| 2 | Comment purge across 19 files (226 `//` + 2 block) — using the **three-bucket rule**, promoting load-bearing rationale to JSDoc rather than deleting it. | Low | ✅ **done** — 226 → 20 (see the status box above for the deliberate keeps). The bucket split was ~66 banners / ~60 narration / **~100 genuine rationale promoted**, far more rationale than the estimated 10–15. |
| 3 | `readonly` on ~98 members (63 in the component). Skip the ~16 genuinely-mutable fields listed above. | Zero | ⬜ not started |
| 4 | JSDoc the ~90 undocumented members. Highest value: the toolbar's 24/24 and the command registry's 5/5. | Zero | ⬜ not started (partially advanced by Rec 2's promotions) |
| 5 | Export the 13 private types **in place**. | Zero | ⬜ not started |
| 6 | Fix the `rich-text-security.spec.ts` deep import. | Zero | ⬜ not started |

> **On `.types.ts` consolidation:** mostly **not worth it**. Barrels don't block
> it (`ui/index.ts:63` re-exports the folder barrel), but most of the 37 types
> read better where they are — `ToolbarButton` sits 7 lines above the array
> that's its only consumer. Moving them makes a reader jump files to learn a
> 4-field shape, and multiplies `registry.json` `files[]` entries. **The one
> exception is `rich-text-editor.types.ts`** (Rec 14), where ~150 lines of
> preamble currently stand between a reader and the class.

### Tier 2 — dedup + readability, low risk, non-breaking

| # | Action | Note |
|---|---|---|
| 7 | Move `coerceEnabled` into **`lib/addon-slots.ts`** — not a new lib file. All 15 RTE registry entries already list `addon-slots.ts` in `libFiles[]`, so this costs **zero registry churn**; a new file would require editing all 15. Deletes 10 copies. | |
| 8 | Delete the 7 tautological `*.context.spec.ts` files. | Also de-inflates the coverage number the Sonar gate reads |
| 9 | Collapse `buttonClasses`/`addonButtonClasses`/`customButtonClasses` into one `toolbarButtonClasses(active: boolean)`. | |
| 10 | Merge `ICONS` (`:116`) into the existing `TOOLBAR_BUTTONS` table (`:90`) and type it `Record<ToolbarItem, ToolbarButton>`, then delete the `getIcon` `?? ''` and `getTooltip` `return item` fallbacks. **The compiler then fails on a missing entry** — that alone kills the silent-failure mode, at no cost. | **Keep `exec` out of the table.** Execution belongs in the component's dispatch; moving it into the toolbar's data would invert the dependency and *add* abstraction. Watch the RTL icon swap at `:263-268`. |
| 11 | Re-export the addon directives + `RTE_FULL` from the root barrel so consumers stop deep-importing. | |
| 12 | Split the 4 longest/deepest methods to clear cognitive complexity 15. | |

### Tier 3 — structural, moderate risk, non-breaking

| # | Action |
|---|---|
| 13 | **Extract the 615 pure lines** into `rich-text-table.utils.ts` (~466, 32 fns) and `rich-text-history.utils.ts` (~149, 9 fns). Mechanical: drop `private`, add `export function`, thread one param in exactly 3 places. Call sites read *better* — `buildCellGrid(table)` tells you no hidden state is involved. The functions become directly unit-testable instead of only through a mounted component; split their tests out of the 6,291-line spec at the same time. Do it as **two commits** (table, then history) so a bisect lands cleanly. **Honest ceiling: this lands the file at ~3,550 lines — still the biggest in the library.** Going further requires either an abstraction that costs more than it saves (see below) or a product decision. |
| 14 | Fold each `*.context.ts` into its own directive file and extract the duplicated `Injector.create` into a `createSlotInjector(token, value, parent)` helper beside `coerceEnabled`. Net **−16 files**, zero runtime change; the per-addon context interface — genuinely good documentation of the directive↔button contract — survives. |
| 15 | Move the component's ~150 lines of type/const preamble into `rich-text-editor.types.ts` and add it to the barrel. |

### Tier 4 — breaking for consumers

| # | Action |
|---|---|
| 16 | **Delete `customToolbarItems` / `customToolbarAction` / `RichTextCustomToolbarItem` / `RichTextEditorRef`.** Blast radius verified as zero in-repo. Migration note drafted below. |
| 17 | Drop `builtinCommands`. **Lowest-value item here** — 8 well-documented lines, and removing it edits the abstract class every addon extends. Do it *only* alongside Rec 16 so both land in one breaking release; otherwise skip it, the cost of keeping it is near zero. |

---

## Two proposals considered and rejected

Recorded with reasons so they aren't re-proposed.

### ❌ `RichTextToolbarSlot.inputs: Record<string, unknown>` fed to `NgComponentOutlet`

The idea was to delete the 9 context tokens by passing plain inputs. It has a
likely correctness problem: `NgComponentOutlet` applies `inputs` through
`ngOnChanges`, which fires only when the bound expression's **reference** changes.
`RichTextToolbarSlot` is fully `readonly`, and the `slotInjectorCache` WeakMap
exists *specifically* to keep slot identity stable so re-registration can't
recreate the component. Therefore:

- Stable `inputs` object → **reactive values never propagate.** An emoji button's
  tooltip would freeze at whatever the locale was at registration.
- Rebuild `inputs` on change → the slot re-registers, `NgComponentOutlet`
  recreates the component, and **any open picker or popover slams shut
  mid-interaction.**

It also wouldn't remove the injector machinery: slot components still inject
`RichTextToolbarViewContext` and `RichTextEditorAddonHost`. **Rec 14 achieves the
same file-count win with no behavioral risk.** If someone still wants this, spike
it on `emoji` alone and specifically assert that changing the locale at runtime
updates the button tooltip.

### ❌ Extracting find & replace / history into services

Each would need the component's `contenteditable` element, `applyMutation`,
`savedRange`, and the signals the template binds to. The three realistic shapes
are: inject the component into the service (a DI cycle), define a port interface
whose only implementation is the component, or hand the component over untyped.
All three mean that answering *"what does Ctrl+F do?"* requires opening three
files instead of one — failing criteria 2, 3 **and** 4 simultaneously. Find &
replace is 185 lines and 8 fields; it is not the problem.

---

## Two gaps worth raising separately

1. **The base editor has no e2e coverage.** All 14 harnesses are `rte-*` — each
   installs the base *plus one addon* and asserts on the addon. Nothing covers the
   base's own table editing, find & replace, history, markdown round-trip, or CVA
   — i.e. precisely the code Rec 13 and Rec 16 touch. `npm run e2e:scaffold --
   rich-text-editor` would create one, and CLAUDE.md arguably already requires it
   ("Every component MUST have an e2e spec under `e2e/harness/<name>/`"). **This
   is the single highest-value safety net before any Tier 3/4 work.**
2. **The e2e labels are `rte-tables`, `rte-history`, … — `npm run e2e --
   rich-text-editor` does not work.** Worth knowing before anyone tries to verify
   a change.

---

## Draft migration note for Rec 16

> **Breaking — `rich-text-editor`: the `customToolbarItems` API is removed.**
>
> Removed: the `[customToolbarItems]` input, the `(customToolbarAction)` output,
> and the `RichTextCustomToolbarItem` and `RichTextEditorRef` types.
>
> **Why:** the editor had three ways to add a toolbar button. This was the
> weakest — it could only render a static icon, and it handed your callback a
> 5-method `RichTextEditorRef` that renamed capabilities the addon host already
> exposes. Two names for one thing made the source harder to read and modify.
>
> **Migrate to a toolbar slot** — a superset of what you had, adding `isEnabled`,
> `order`, and full component slots:
>
> ```ts
> const host = inject(RichTextEditorAddonHost);
> host.toolbarSlots.register({
>   id: 'my-button',
>   icon: MY_SVG,
>   tooltip: 'My action',
>   order: 500,
>   isEnabled: () => !host.disabled(),
>   onClick: () => host.insertTextAtCaret('…'),
> });
> ```
>
> `addons/emoji/` is the reference implementation.
>
> **Name mapping:** `ref.insertText` → `host.insertTextAtCaret` ·
> `ref.insertHtml` → `host.insertHtmlAtCaret` · `ref.getSelectedText` →
> `host.selection().text` · `ref.getHtmlContent` → `htmlOutput()` · `ref.focus` →
> focus `host.contentRoot`.
>
> **If you haven't customised your copy**, re-run
> `npx shadcn-angular update rich-text-editor`. **If you have**, the only edits
> needed are in your own template — the editor's internals are otherwise
> source-compatible.

---

## If any of this is acted on

No source was modified for this review, so no gate applies yet. Acting on any
recommendation makes these mandatory (CLAUDE.md §4):

```bash
npm run lint
npm run coverage      # MUST precede sonar, or it reports 0% and skews findings
npm run sonar         # Dockerized scanner → localhost:9000, fix ALL new issues
npm run test-visual   # full suite; zero failures tolerated
npm run e2e -- rte-tables rte-history      # and the labels your change touches
node scripts/sync-registry.ts --fix        # after any file add/delete
```

Per CLAUDE.md's publish rules this is all component/lib source, so it goes live
on merge to `master` with **no CLI publish** — which makes the changelog entry the
only signal consumers get for Rec 16.
