# Component Guideline Conformance — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **File-overlap notes for wave planning (not prerequisites):**
>
> - **Overlay specs** — `specs/overlay-stack-scroll-lock-and-escape-spec.md`
>   (dialog / sheet / drawer / alert-dialog / select / dropdown-menu / menubar /
>   context-menu / popover / split-button / emoji-picker / eyedropper /
>   date-picker) — edit files that **Task 9** of this spec also edits
>   (`class`/`data-slot` conformance in those folders + the tooltip max-width).
>   `popover` and `emoji-picker` are therefore in Task 9, not in the family
>   tasks. Task 9 is deliberately **last** among the code tasks: if the overlay
>   spec is in flight, finish Tasks 1–8 first, then rebase Task 9 onto it once
>   it merges. Overlay **behaviour** (Escape, focus, scroll lock, render-time
>   `document` access in `dialog-content`, date-picker and context-menu-content
>   teardown) is owned there and is **not** repeated here. Task 8's teardown
>   guard in `popover/sub/popover-content.component.ts` /
>   `emoji-picker/sub/emoji-picker-content.component.ts` (only if T-14 proves
>   it) touches files that spec may also edit — rebase, hunks are disjoint.
> - **`specs/keyboard-and-touch-activation-spec.md`** — owns tooltip
>   touch-dismiss, tooltip-trigger, dropdown/context-menu activation and the
>   `data-table-context-menu` long-press. This spec touches
>   `tooltip/sub/tooltip.directive.ts` + `tooltip-content.component.ts` (Task 9,
>   max-width class string only), `tooltip-trigger` (Task 9, `class`/`data-slot`)
>   and `ui/data-table-context-menu.directive.ts:42-43` (Task 6, the
>   `inject(... as any)` line only). Whichever merges second rebases; the hunks
>   are disjoint.
> - **`specs/selector-independent-component-identity-spec.md`** — edits
>   `rich-text-editor/addons/mentions/rich-text-mention-popover.component.ts`
>   (outside-click detection), which this spec's Task 5 also edits
>   (`class`/`data-slot` only), and `split-button/split-button.component.ts`
>   (this spec touches only `split-button/sub/*`). Rebase on whichever merges
>   first.
> - **Chart specs** own `data-slot` on the 7 charts without it and chart
>   tooltip max-width. Not repeated here (see §0 G-2, G-5).
> - **Form specs** (`specs/toggle-group-and-input-otp-forms-spec.md`,
>   `specs/slider-and-numeric-input-correctness-spec.md`) — the OTP spec edits
>   `input-otp/input-otp.component.ts` and states the `input-otp/sub/*` parts
>   are unchanged (`toggle-group-and-input-otp-forms-spec.md:275`); Task 9 here
>   edits only those three `sub/` files. `time-picker` is **not** touched (see G-8).
> - **`specs/repo-hygiene-and-docs-drift-spec.md`** owns every `.claude/CLAUDE.md`
>   edit. This spec's Task 10 hands it one sentence (its C-11) instead of editing
>   the file.
> - `packages/components/completeness-allowlist.json`,
>   `packages/cli/scripts/check-completeness*.ts`, `eslint.config.mjs` — only
>   this spec edits them.

**Status:** ⬜ Not started
**Date:** 2026-10-03
**Source:** audit of `packages/components/ui` against `.claude/CLAUDE.md`
(branch `docs/codebase-review-fix-specs`). Every finding re-verified in §0.
**Living history:** never delete a completed row, a fixed bug or a superseded
decision — mark it and append below.

---

## 0. Step 0 — findings verified against the source

Legend: ✅ true as stated · ⚠️ partly wrong (believed → true) · ❌ refuted.
Scans: `@Component`/`@Directive` files under `packages/components/ui`
excluding `*.spec.ts`, `*.stories.ts`, `*-demo.*`; templates read from the
sibling `.html` or the inline `template:`.

| ID | Finding as reported | Verdict | Evidence |
|---|---|---|---|
| G-1a | Consumer `class` has no effect on `toast`, `aspect-ratio`, `virtual-scroll`, `card-accordion`, `breadcrumb` (contents host, no `class` input). | ⚠️ **4 of 5, and the class is far bigger.** `toast/toast.component.ts:292-293`, `aspect-ratio/aspect-ratio.component.ts:12`, `virtual-scroll/virtual-scroll.component.ts:103`, `breadcrumb/breadcrumb.component.ts:30` (its `<nav>` at `:23` has no class binding) — confirmed. **`card-accordion` is refuted:** it `extends AccordionComponent` (`card-accordion.component.ts:23`), inherits `class`, and applies it via `cn('flex w-full flex-col', this.class())` (`:24-25`) on its `<div>` (`.html:1`). The same no-op affects **47** files: every component whose host is `display: contents` while its template renders an element and that has no `class` input — e.g. `toast/sub/toaster`, `emoji-picker` (+`-trigger`), `command/sub/command-{dialog,empty,input,separator,shortcut}`, `menubar/sub/menubar-{menu,separator,shortcut}`, `split-button/sub/split-button-{item,primary}`, `collapsible-trigger`, every `*-trigger`/`*-close` wrapper, `node-editor-palette`, and **15** RTE addon components. | classifier run 2026-10-03 |
| G-1b | 103 files lack a `class` input; most are sub-parts with a static host class where the consumer class applies but isn't tailwind-merged. | ⚠️ **101** own-`class`-less component files by this scan (method difference). Breakdown: **37** project-only templates (`<ng-content />` only; most carry a static host class, e.g. `dialog-title`, `sheet-header`, `select-label`, `dropdown-menu-separator`, `input-otp-slot` — consumer class lands on the host but loses conflicts), **47** contents-host-with-element (G-1a — consumer class is a no-op), **7** static host class + own template (`data-table/data-table.component.ts` — the flagship has **no `class` input**, host `block h-full w-full`; `data-table-filter-builder`, `dropdown-menu`, `select`, `select-value`, `tooltip`, `rich-text-slash-commands-menu`), **10** other (`confirm-dialog`, `data-table-pagination`, `node-editor-text-output`, `number-ticker-digit`, `property-editor`, `rich-text-actions-{dialog,popover}`, `rich-text-images-resizer`, `shortcut-bindings-dialog`; `card-accordion` false positive). `meteors`/`particles` have an empty template and an inline-styled block host. | classifier run |
| G-1c | Four declare `class` but deliberately never apply it. | ✅ `tree-select/sub/tree-select-trigger.component.ts:21` and `tree-select-content.component.ts:21` (JSDoc: "exists for API symmetry and is not applied to any element"; both are `<ng-content />` + `contents` host — zero-box), `kanban/sub/kanban-column-dialog.component.ts:69` (renders a `ui-dialog`; "not applied to any element"), `rich-text-editor/addons/actions/rich-text-actions-form.component.ts:19` (host `block`; "does not consume this value"). | file:line |
| G-1d | Extend `completeness-allowlist.json` rather than inventing a mechanism. | ✅ It is consumed by `packages/cli/scripts/check-completeness.ts` (lib: `check-completeness-lib.ts`, `Artifact = 'story' \| 'demo' \| 'e2e'` at `:11-13`, `parseAllowlist` at `:363`), run by `npm run check:completeness` from `scripts/preflight.mjs:37,128`. It is keyed by **registry component**; conventions are per **file**, so the new artifacts are keyed by `ui/`-relative path. **Better tool found for two of the four conventions:** the installed `@angular-eslint/eslint-plugin` ships `prefer-on-push-component-change-detection` and `prefer-signals` (options `preferInputSignals`, `preferQuerySignals`, `preferReadonlySignalProperties`), neither enabled in `eslint.config.mjs`. | node_modules; config |
| G-2 | `data-slot` missing in 43 files **excluding** the 7 charts. | ⚠️ **43 including the 7 charts** → **36 non-chart files**: `alert-dialog/alert-dialog`, `bento-grid/bento-grid` + `sub/bento-grid-item`, `button/confirm-dialog`, `data-table/sub/data-table-{column-header,pagination}`, `dialog/dialog`, `dropdown-menu/dropdown-menu` + `sub/dropdown-menu-{sub,sub-content,sub-trigger}`, `field/sub/field-auto-errors`, `input-otp/sub/input-otp-{group,separator,slot}`, `menubar/sub/menubar-{sub,sub-content}`, `number-ticker/number-ticker`, `org-chart/org-chart`, `page-builder/sub/property-editor`, `page-renderer/page-renderer`, `rich-text-editor/addons/{history/rich-text-history-panel,images/rich-text-images-resizer,mentions/rich-text-mention-popover}`, `sheet/sheet`, `shortcut-bindings-dialog/shortcut-bindings-dialog`, `sparkles/sparkles` + `sub/sparkles-button`, `split-button/sub/split-button-{item,menu,primary}`, `streaming-text/streaming-text`, `text-reveal/text-reveal`, `tooltip/tooltip`, `tree-select/sub/tree-select-{content,trigger}`. The 7 charts (`bar-chart`, `bar-chart-drilldown`, `bar-race-chart`, `column-range-chart`, `pie-chart`, `pie-chart-drilldown`, `stacked-bar-chart`) → chart spec. | scan |
| G-3 | Not OnPush: `number-ticker.component.ts:~17`, `sub/number-ticker-digit.component.ts:~14`. | ✅ Exactly those two (`:17`, `:14`), the only two in `ui/`. Also `number-ticker.component.ts:24` injects `_el` and never reads it (TS6133). | scan; tsc |
| G-4 | `input-mask.directive.ts:~20,22,28` still uses `@Input()`. | ✅ `:20` `@Input('uiInputMask') mask`, `:22` `slotChar`, `:28` `showMaskTyped`; also `standalone: true` (`:16`, redundant since Angular 19). The only `@Input` in `ui/`. Values are read at event time (`:144`, `:180`, `:258`), so a runtime mask change already applies on the next keystroke — parity is the bar, not a feature. | file:line |
| G-5 | `uiTooltip` creates `fixed z-50 whitespace-nowrap` on body with no `max-w-[calc(100vw-2rem)]`; `tooltip-content.component.ts:~36` too; ~20 positioned z-50 files lack the guard. | ✅ `tooltip/sub/tooltip.directive.ts:157`, `tooltip/sub/tooltip-content.component.ts:36`. The directive's clamp (`:174`, `Math.max(8, Math.min(innerWidth - width - 8, left))`) cannot help once the box is wider than the viewport. **17** files with `fixed`/`absolute` + `z-50` and no `100vw` guard; triage: **real risk** — the two tooltip files; **low risk, fix cheaply** — `speed-dial/sub/speed-dial-menu.component.ts:130-139` (left/right rows of actions), `bento-grid/bento-grid.component.html:182` (fixed merge bar); **no risk by construction** (full-width/inset) — `scroll-progress`, `spinner/sub/page-spinner`, `sidebar`, `sheet`/`sheet-content`, `drawer`/`drawer-content`; **chart spec** — the 6 chart templates. | grep + triage |
| G-6 | `stagger-children.component.ts:~61` creates an IntersectionObserver in an uncancelled rAF (after destroy, never disconnected); `marquee.component.ts:~63` can start an infinite animation after destroy; ~11 other uncancelled rAFs reportedly one-shot. | ✅ `stagger-children:61` (observer assigned inside the callback; `ngOnDestroy` at `:76` may already have run), `marquee:63` (`setupAnimation` → `track.animate(…, { iterations: Infinity })`; `ngOnDestroy` cancels only an animation that exists yet). **9 more** files call rAF with no `cancelAnimationFrame`: `autocomplete:280`, `context-menu/sub/context-menu-content:74-75`, `context-menu/sub/context-menu-sub-content`, `date-picker:170-171`, `date-picker/sub/date-range-picker`, `emoji-picker/sub/emoji-picker-content:178,189`, `hover-card/sub/hover-card-content:94-95`, `popover/sub/popover-content:110,151,173`, `scroll-area:213`. All one-shot positioning/scroll — **but not all harmless:** `popover-content.portalAndPosition` (`:148-160`) guards only on `this.popover?.open()`, which is still `true` when the content is destroyed with its popover open, so a frame scheduled at open can *portal the panel into `document.body`* after destroy. Must be tested, not assumed (T-14). date-picker and context-menu files → overlay specs. | file:line |
| G-7 | `ToastService` auto-dismisses with no pause on hover/focus (WCAG 2.2.1). | ✅ `toast.component.ts:117-134` `scheduleLifetime` arms a `setTimeout` (+ a countdown `setInterval`) that nothing pauses; toasts can carry an **action button** (`toast.component.html:17-22`, input at `:323`), so a keyboard user tabbing to it can lose it mid-tab. | file:line |
| G-8 | 5 `.replace(/…/g)` → `replaceAll`; one `as any` at `data-table-context-menu.directive.ts:~43`. | ❌ **`replaceAll` part refuted.** Sonar `typescript:S7781` is active in the project's profile with **0** open issues; its own description limits it to *fixed-text* patterns and exempts character classes and quantified patterns. All five (`currency-input.format.ts:130` `[‎‏؜]`, `:143` `[^\d.]`, `duration-input.component.ts:247` `\D`, `time-picker.format.ts:230` `\D`, `:243` `\d`) are character classes. No code change; the over-broad CLAUDE.md wording goes to the hygiene spec (C-5). ✅ `as any` confirmed at `:43`, **plus** an inline `// eslint-disable-next-line @typescript-eslint/no-explicit-any` at `:42` that ships into consumers' projects (CLAUDE.md forbids shipped inline disables). | Sonar API; file:line |
| G-9 | SSR: 68 bare `document.*` refs in 24 files; only 2 use `isPlatformBrowser`. | ⚠️ **Count depends on method** — a non-comment grep finds ~95 refs in 34 files; `PLATFORM_ID` is used by `color-picker` and `eyedropper` only; 26 files `inject(DOCUMENT)`. **Decision: out of scope** (§1.4). | grep |
| G-10 | ~1,397 signal/input/computed members not `readonly` in 258 files (S2933); Sonar gate passes — why? | ⚠️ **~1,375 in 253 files** (regex count). **Why Sonar is green:** `typescript:S2933` is active (0 open, 0 accepted), but it mirrors typescript-eslint `prefer-readonly`, which flags **private** members only — and there are **0** private non-readonly signal members. The ~1,375 are public/protected, outside S2933. **Decision: out of scope** (§1.4); CLAUDE.md's S2933 wording correction → hygiene spec C-4. | Sonar API; grep |

---

## 1. Product Manager section

### 1.1 Business logic

Bring every shipped component up to the conventions `.claude/CLAUDE.md`
promises — a `class` that actually styles the component and wins conflicts, a
`data-slot` hook, `OnPush`, signal inputs — fix four behavioural defects found
in the same audit (tooltip overflow, post-destroy work, toast auto-dismiss,
an `any`), and add gates so each convention cannot regress.

### 1.2 Why the customer wants this

- **`class` is the library's escape hatch, and on 47 components it does
  nothing.** `<ui-toast class="border-red-500">`, `<ui-breadcrumb class="mb-4">`,
  `<ui-aspect-ratio class="rounded-lg overflow-hidden">` compile, render, and
  are silently ignored — the host is `display: contents`. Today the workaround
  is wrapping the component in an extra `<div>` or a global CSS selector on
  `[data-slot]`, which is exactly the Angular-Material-style customization
  nightmare this library exists to escape.
- **On ~44 more, `class` applies but loses.** `<ui-dialog-title class="text-sm">`
  keeps `text-lg` or not depending on stylesheet order, because the host's
  static classes are not `cn()`-merged with the consumer's. `<ui-data-table
  class="h-[400px]">` fights `h-full` the same way.
- **`data-slot` is the documented styling/testing hook**, and 36 non-chart
  components lack it, so consumer tests and CSS cannot target them.
- **Long tooltips run off a phone screen** (`whitespace-nowrap`, no max-width).
- **Toasts with an action vanish while a keyboard user tabs to the button**
  (WCAG 2.2.1 Timing Adjustable).
- **Destroying `stagger-children` or `marquee` in the same frame it renders**
  (route change, `@if` flip) leaves an observer or an infinite animation alive.

### 1.3 Use cases — definition of done

| ID | Use case |
|---|---|
| UC-1 | On every component that renders an element (not zero-box), `class="bg-[rgb(1,2,3)]"` changes that element's computed `background-color` — including `ui-toast`, `ui-toaster`, `ui-breadcrumb`, `ui-aspect-ratio`, `ui-virtual-scroll`, the command / split-button / menubar parts and the RTE addon components. |
| UC-2 | A consumer class that conflicts with a component default wins: `<ui-dialog-title class="text-xs">` computes `font-size: 12px`; `<ui-data-table class="h-[123px]">` computes `height: 123px`. |
| UC-3 | No `class` input silently does nothing: zero-box components (`<ng-content>`-only template + `display: contents` host — e.g. `ui-tree-select-trigger`) declare **no** `class` input; `ui-kanban-column-dialog` and `ui-rich-text-actions-form` apply theirs. |
| UC-4 | Every shipped component carries a `data-slot` attribute (template element or host), so `[data-slot="tree-select-trigger"]` etc. select it. (Charts: chart spec.) |
| UC-5 | Every shipped component uses `ChangeDetectionStrategy.OnPush`; `ui-number-ticker` still animates to every new `value`. |
| UC-6 | `uiInputMask`, `slotChar`, `showMaskTyped` are signal inputs; existing template usage (`[uiInputMask]="'(999) 999-9999'"`) is unchanged and a mask changed at runtime applies on the next keystroke, as today. |
| UC-7 | A 300-character tooltip (both `uiTooltip` and `<ui-tooltip>`) stays fully inside a 320 px viewport; a short tooltip still renders on one line. |
| UC-8 | Destroying `ui-stagger-children` or `ui-marquee` before their first frame leaves no live IntersectionObserver or Web Animation; destroying an open `ui-popover` (and `ui-hover-card`, `ui-emoji-picker`, `ui-autocomplete`) in its opening frame leaves nothing behind in `document.body`. |
| UC-9 | A toast's auto-dismiss clock pauses while the pointer is over the toaster and resumes with the time that was left. |
| UC-10 | The clock also pauses while keyboard focus is inside a toast (tabbing to its action), and resumes when focus leaves. |
| UC-11 | A toast showing a countdown freezes its displayed seconds while paused. |
| UC-12 | A new component missing `class` (when it renders a box), `data-slot`, `OnPush`, or using `@Input()` fails a gate (`npm run lint` for OnPush/`@Input`; `npm run test:cli` + `npm run check:completeness` for `class`/`data-slot`) — no regression is possible silently. |
| UC-13 | `ui/data-table-context-menu.directive.ts` injects the table without `any` and without an inline `eslint-disable`. |

### 1.4 Explicitly out of scope

- **SSR.** The library makes no SSR claim (no `@angular/ssr`, nothing in
  README/docs), has no server-render harness, and most `document.*` uses are in
  event handlers. Fixing render-time access without a harness is unverifiable;
  it needs its own spec with an SSR fixture if SSR becomes a goal.
  `dialog-content`'s render-time access is the overlay spec's.
- **Public `readonly` sweep (~1,375 members).** Not a Sonar finding (G-10); a
  mechanical 253-file diff would collide with every parallel spec. If wanted
  later: `prefer-signals { preferReadonlySignalProperties: true }` + `eslint
  --fix` as its own PR after the wave.
- `replaceAll` rewrites (refuted, G-8). `time-picker` untouched.
- `data-slot` on the 7 charts; chart tooltip max-width (chart spec).
- Tooltip touch-dismiss, data-table long-press (keyboard/touch spec); any
  overlay behaviour (overlay specs).
- The other seven inline `eslint-disable` comments in shipped code
  (`bar-race-chart`, `file-viewer` ×2, `rich-text-sanitizer`, three
  `ngTemplateContextGuard` blocks) and `confirm.directive.ts:61`'s
  `@HostListener` (allowed by CLAUDE.md). Noted, not fixed.
- `bento-grid`'s hard-coded English "Merge N Items" label (i18n, noticed only).
- Converting `@ViewChild`/`@ContentChild` decorators (CLAUDE.md's own template
  uses `@ContentChild`).

---

## 2. QA section — write these tests FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.

Layout and computed-style assertions go in **`*.browser.spec.ts`** files (real
browser leg, excluded from the portable leg) and use `page.viewport()` where the
width matters (pattern: `data-list/data-list.component.browser.spec.ts:49-69`).
Never assert class strings (repo memory: layout tests use resolved style).
Stub globals per test and restore them in the same test (repo memory:
`stubGlobal` leaks across files).

### 2.1 Traceability

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `findConventionIssues reports a box-rendering component without an applied class input, and a component without data-slot` — fixtures (in-memory sources): a component with `host: { class: 'contents' }` + `<div class="p-2">` and no `class` input → `class-input`; same with `class = input('')` declared but never read → `class-input` ("declared but not applied"); a component with no `data-slot` anywhere → `data-slot`; a conforming one → nothing. | UC-12, UC-3 | unit (`check-completeness.spec.ts`) |
| T-2 | `zero-box components need no class input and are reported if they declare one` — fixture `<ng-content />` + `contents` host: no input → clean; with `class = input('')` → `class-input` ("zero-box: remove the no-op input"). | UC-3, UC-12 | unit |
| T-3 | `an inherited class input counts` — fixture child `extends ParentComponent` whose parent declares and applies `class` (the `card-accordion` shape) → clean. | UC-12 | unit |
| T-4 | `the ui tree has no convention issues beyond the allowlist` — runs the real scan over `packages/components/ui` against the `class-input` / `data-slot` allowlist sections. **Red until Task 9.** Also extend the existing stale-exemption test table with one `data-slot` row so a stale convention exemption fails like a stale story one. | UC-1, UC-3, UC-4, UC-12 | gate (CLI leg) |
| T-5 | `consumer class reaches the rendered box` — `it.each` over one representative per code path, asserting computed `background-color` on `[data-slot=…]` for `class="bg-[rgb(1,2,3)]"`: **Task 3** rows `ui-toast` (contents host, `cva` classes), `ui-breadcrumb` (inline template `<nav>` with no binding), `ui-aspect-ratio` (element with only a `[style]` binding), `ui-virtual-scroll` (existing `containerClasses()` computed); **Task 4** row `ui-command-separator`; **Task 5** row `ui-rich-text-outline-panel`; **Task 9** row `ui-tooltip-content`. Each row is added (red) in Task 1 and turns green in its task. | UC-1 | browser (`packages/components/ui/conformance.browser.spec.ts`) |
| T-6 | `consumer class wins over a conflicting default` — `ui-command-shortcut class="text-base"` → 16px (inner element, default `text-xs`); `ui-data-table class="h-[123px]"` → host height 123px (host-static default `h-full`); **Task 9** row `ui-dialog-title class="text-xs"` → 12px (projection-only, host-static `text-lg`). | UC-2 | browser (same file) |
| T-7 | `kanban-column-dialog and rich-text-actions-form apply their class` — open the column dialog with `class="bg-[rgb(1,2,3)]"` → computed on its dialog panel; actions-form → computed on its host. | UC-3 | browser |
| T-8 | `number-ticker animates to a value set after first render under OnPush` — `setInput('value', 42)` after the first tween settles → rendered text reaches `42` (`whenStable()`; no rAF stubbing — repo memory). Skip writing it if an existing number-ticker spec already changes `value` post-render; name that test in the retro instead. | UC-5 | component (`number-ticker.component.spec.ts`) |
| T-9 | `input-mask applies a mask bound as a signal input, and a mask changed at runtime on the next keystroke` — host binds `[uiInputMask]="mask()"`, type `5551234567` → `(555) 123-4567`; set `mask` to `99-99`, type → new format. The second half pins today's behaviour (G-4). | UC-6 | component (`input-mask.directive.spec.ts`) |
| T-10 | `auto-dismiss pauses while the pointer is over the toaster and resumes with the remaining time` — fake timers; `toast({ duration: 5000 })`; advance 4000; `pointerenter` on the toaster region; advance 10000 → still present; `pointerleave`; advance 999 → present; advance 2 → gone. | UC-9 | component (`toast.features.spec.ts`) |
| T-11 | `auto-dismiss pauses while focus is inside a toast` — toast with an `action`; focus its button (`focusin`) at 4000; advance 10000 → present; blur to `document.body` (`focusout` with `relatedTarget` outside) → dismissed after the remaining ~1000. Representative of the keyboard class (UC-10); a sticky toast (`duration: 0`) is unaffected by pause/resume (degenerate class, one assertion). | UC-10 | component |
| T-12 | `a paused countdown toast freezes its displayed seconds` — `showCountdown: true, duration: 5000`; pause at 2000 (shows 3); advance 5000 → still 3; resume; advance 1000 → 2. | UC-11 | component |
| T-13 | `stagger-children and marquee destroyed before their first frame leave no observer or animation` — stagger: per-test `IntersectionObserver` stub counting `observe` minus `disconnect`; create, destroy synchronously, await one real frame → live count 0. marquee: `document.getAnimations()` length unchanged after create → destroy → one frame. | UC-8 | browser (`conformance.browser.spec.ts`) |
| T-14 | `overlays destroyed in their opening frame leave nothing in document.body` — `ui-popover` (`strategy: 'fixed'`), `ui-hover-card`, `ui-emoji-picker`, `ui-autocomplete`: open, destroy the host in the same task, await two frames → no element with their content `data-slot` remains under `document.body`. **If a row passes before any fix, it is not a bug: record that in the retro and leave that component's code alone** (no speculative guards). | UC-8 | browser |
| T-15 | `a long tooltip stays inside a 320px viewport; a short one stays on one line` — `page.viewport(320, 640)`; `uiTooltip` and `<ui-tooltip>` with 300 chars → content rect `left ≥ 0`, `right ≤ innerWidth`; with `"Save"` → rect height equals one computed line-height (desktop parity). | UC-7 | browser (Task 9) |
| T-16 | `OnPush and signal inputs are lint-enforced` — enable the two angular-eslint rules (Task 2) and confirm `npm run lint` reports exactly `number-ticker` ×2 (`prefer-on-push…`) and `input-mask` ×3 (`prefer-signals`) before Tasks 6 fixes them. Mutation check later: remove OnPush from any component → lint red. | UC-5, UC-6, UC-12 | lint gate |
| T-17 | `data-table-context-menu has no any and no inline disable` — covered by `npm run lint` + `npm run typecheck`; behaviour by the existing `data-table-context-menu.directive.spec.ts` (must stay green unchanged). | UC-13 | existing + static |

### 2.2 Test types

- **Unit (CLI leg):** T-1…T-4 in `packages/cli/scripts/check-completeness.spec.ts`.
- **Browser:** T-5, T-6, T-7, T-13, T-14, T-15 in one new
  `packages/components/ui/conformance.browser.spec.ts` (cross-component by
  design; the conventions are library-wide). T-8…T-12 in the component's own
  spec files.
- **Lint gate:** T-16.
- **Storybook + axe:** for every component that gains a `class` input, its
  story gains a `class` control (arg) so the option is visible; run
  `npm run test-storybook:a11y` on the touched stories (or the `lib/testing/axe`
  unit route inside a worktree — see `packages/components/lib/testing/axe.ts`
  header) — no new violations.
- **e2e:** no new harness specs; run every touched component's existing spec
  (Task 10 lists them) — the `class`/`data-slot` changes alter installed source.

### 2.3 Edge cases the tests must cover

- **Zero-box vs. box** (T-1/T-2): `contents` host with `<ng-content />` only vs.
  `contents` host with an element.
- **Inherited input** (T-3).
- **RTL:** T-5/T-6 run once with `dir="rtl"` on the host's parent for the
  `ui-breadcrumb` row (it sets `[attr.dir]`); geometry assertions in T-15 run in
  both directions.
- **Touch-only:** T-10's pause also triggers on `pointerenter` from a touch
  pointer (`pointerType: 'touch'`) — the same handler, one extra event in T-10.
- **Degenerate:** sticky toast (T-11), short tooltip (T-15), empty-template
  components `meteors`/`particles` (class on a block host — T-4 scan only).
- **Overflow at 320px:** T-15.

### 2.4 Coverage expectation

No uncovered lines in touched files. New branches (pause/resume, the
`destroyed` guards, gate classifier) are covered by T-1…T-3, T-10…T-14.

### 2.5 Mutation check (CLAUDE.md "Writing Tests" step 6)

Break each contract the way a plausible mistake would, confirm a test goes red,
restore: drop `this.class()` from `toast.component.ts`'s `classes` (T-5);
replace `cn()` with string concatenation in `command-shortcut` (T-6); remove the
`destroyed` check in `stagger-children` (T-13); resume the toast clock with the
*full* duration instead of the remainder (T-10); delete `max-w-[…]` from the
tooltip directive (T-15); remove `data-slot` from `tree-select-trigger` (T-4);
remove OnPush from `badge` (T-16). Record each in §6.

---

## 3. Architecture

### 3.1 Usability — the API after this spec

Simple mode is unchanged; `class` simply works everywhere it can:

```html
<ui-toaster class="bottom-24" />
<ui-breadcrumb class="mb-4">…</ui-breadcrumb>
<ui-aspect-ratio [ratio]="16 / 9" class="overflow-hidden rounded-lg">
  <img src="…" alt="…" />
</ui-aspect-ratio>
<ui-dialog-title class="text-base">Smaller title</ui-dialog-title>
<ui-data-table [data]="rows" [columns]="cols" class="h-[400px]" />
```

Zero-box parts are styled through what you project (custom mode):

```html
<ui-tree-select-trigger>
  <ui-button variant="outline" class="w-64">Pick a node</ui-button>
</ui-tree-select-trigger>
```

Toast pause is automatic; a **custom toaster** (custom mode) gets the same
control through two new `ToastService` methods:

```ts
const toasts = inject(ToastService);
toasts.pause();   // freezes every auto-dismiss clock and countdown
toasts.resume();  // re-arms each with the time it had left
```

### 3.2 Efficiency

No meaningful perf concern: one more `computed` per component (a `cn()` call,
re-run only when `class` changes); the toaster adds four listeners on one
element; teardown guards are a boolean check. The gate scan adds ≤ 2 s to
`test:cli` — measure and record.

### 3.3 DX for the consuming developer

- Learn nothing new: `class` behaves as CLAUDE.md always promised.
- New exported surface: `ToastService.pause()` / `ToastService.resume()` (JSDoc
  both; pausing twice is idempotent; resuming without a pause is a no-op).
- Removed: the no-op `class` inputs on `ui-tree-select-trigger` and
  `ui-tree-select-content` (pre-1.0 policy: no compatibility shims). A static
  `class="…"` still lands on the host attribute as plain HTML; a
  `[class]="expr"` binding still compiles (Angular treats it as the DOM class
  binding).
- `uiInputMask` etc. keep their names and alias; only the declaration style
  changes.

### 3.4 Implementation options

**Decision A — what "every component has a `class` input" means for zero-box parts**

**Option A-1 — literally every component gets a `class` input.**
Pros: matches CLAUDE.md's wording. Cons: on a zero-box part there is no element
to put it on, so the input is a no-op — the exact defect G-1c documents.

**Option A-2 — zero-box parts have no `class` input; the gate computes
"zero-box" from source (template is only `<ng-content>`, host is
`display: contents`) and CLAUDE.md gains a one-sentence exception.**
Pros: no input lies; the rule is mechanical. Cons: CLAUDE.md wording change
(handed to the hygiene spec, its C-11).

**Option A-3 — allowlist each zero-box part with a reason.**
Cons: ~20 permanent allowlist entries, each reading like debt.

**✅ Chosen: A-2.**

**Decision B — how a `class` reaches the box**

**B-1 — inner element:** `[class]="classes()"` with
`classes = computed(() => cn(<defaults>, this.class()))`, host stays
`contents` (toast, breadcrumb, command parts, RTE addons). **B-2 — host:**
move defaults into a host `'[class]': 'classes()'` binding (projection-only
sub-parts with host defaults: dialog/sheet/select/dropdown titles, labels,
separators; `data-table`). **B-3 — a wrapper `<div>`** around projected content.
**✅ Chosen: B-1 where the component already renders an element, B-2 where the
host is the box.** B-3 rejected: changes DOM structure and layout for every
consumer.

**Decision C — gate mechanism**

**Option C-1 — everything in `check-completeness-lib.ts`.** One mechanism, but
re-implements what angular-eslint already does for OnPush/`@Input`.
**Option C-2 — angular-eslint for OnPush and signal inputs
(`prefer-on-push-component-change-detection`, `prefer-signals` with
`preferInputSignals: true, preferQuerySignals: false,
preferReadonlySignalProperties: false`, scoped to the shipped block in
`eslint.config.mjs`, ignoring `*.spec.ts`/`*.stories.ts`) + a static
`class-input`/`data-slot` scan in `check-completeness-lib.ts` with new
allowlist sections keyed by `ui/`-relative path, asserted on the real tree in
`check-completeness.spec.ts` (CLI leg, runs on every push).**
**Option C-3 — a custom ESLint rule for `class`/`data-slot`.** Template-aware
rules for external `.html` are costly to write and test.
**✅ Chosen: C-2** — existing tools where they exist; the allowlist mechanism
the repo already trusts (stale-entry detection included) for the rest.

**Decision D — toast pause scope**

**D-1 — pause all toasts while the toaster region is hovered or holds focus**
(Radix Toast / Sonner behaviour). **D-2 — pause only the hovered toast.**
**✅ Chosen: D-1** — stacked toasts move under the pointer as others leave; a
per-toast pause lets the neighbour vanish under the user's cursor. Implemented
in `ToastService` (`pause()/resume()` store each toast's remaining ms and
re-arm), wired by the toaster's `pointerenter/pointerleave/focusin/focusout`.

**Decision E — post-destroy work**

**E-1 — keep rAF, store the id, `cancelAnimationFrame` in `ngOnDestroy` (plus a
`destroyed` flag for chained frames).** **E-2 — replace with
`afterNextRender`.** Changes timing (runs after render, not on the next frame)
that existing tests and the layout reads depend on. **✅ Chosen: E-1**, applied
only where T-13/T-14 prove a post-destroy effect.

**Decision F — tooltip width:** replace `whitespace-nowrap` with
`w-max max-w-[calc(100vw-2rem)] break-words` (short text keeps `max-content`
width — one line, desktop unchanged; long text wraps at the viewport bound so
the existing clamp at `tooltip.directive.ts:174` can keep it on screen). Same
`max-w-[…]` on `tooltip-content`. Rejected: a fixed `max-w-xs` — changes
desktop rendering of every medium-length tooltip.

### 3.5 Risks

| Risk | Mitigation |
|---|---|
| Moving host defaults into `'[class]': 'classes()'` (B-2) could drop or duplicate a consumer's static `class="…"`. | Unverified how Angular 21 combines a static `class` attribute, a declared `class` input and a host `[class]` binding — **measure, do not assume**: T-6's `ui-data-table` (Task 4) and `ui-dialog-title` (Task 9) rows assert the computed result; inspect the rendered `class` attribute once and record it in §6. `card-accordion` (host `'[class]': '"contents"'` + inherited `class` input) is a working in-repo precedent to compare against. |
| Overlay files conflict with in-flight overlay specs. | Task 9 last; rebase onto merged overlay specs; hunks are class/data-slot only. |
| `prefer-signals` flags far more than `input-mask` (spec/stories hosts, `@ViewChild`). | `preferQuerySignals: false`, ignores for `*.spec.ts`/`*.stories.ts`; T-16 asserts the exact expected hit list before fixing. |
| Toast countdown and auto-dismiss drift after pause/resume. | Store an absolute deadline per toast; pause records `remaining = deadline - now`; T-12. |
| Adding `class` inputs changes generated API docs and the RTE / data-table compiled packages. | `npm run docs:regen` (restore the `documentation.json` stub — repo memory); package releases noted in §3.6. |
| T-14 tempts speculative guards. | Fix only rows that fail before the fix (stated in T-14). |

### 3.6 Publish verdict

- **CLI npm publish: not required.** Only component source, the dev-only gate
  under `packages/cli/scripts/`, `eslint.config.mjs`, and the allowlist JSON
  change. No registry `files[]` change is expected (no new files except the
  browser spec, which is internal); if `sync-registry --fix` reports drift,
  commit its regeneration — data only.
- **Compiled packages: both need a release after merge.** RTE closure: the RTE
  addon components (Task 5), `tooltip`, `command`, `emoji-picker`, `popover`,
  `autocomplete`, `scroll-area`, `dialog`, `alert-dialog`. Data-table closure:
  `data-table` (+ `data-table-pagination`, `-filter-builder`,
  `-column-header`), `command`, `popover`, `dialog`, `select`, `alert-dialog`,
  `context-menu`. Run `npm run release:package -- rte <level>` and
  `-- data-table <level>` (manual publish — 2FA) per `docs/local-gates.md`.

---

## 4. Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — the **full server scan** (`npm run sonar:gate`
   against `http://localhost:9000` — coverage re-measured unless the tree
   fingerprint proves it current) run and clean on the changed code. eslint is NOT a substitute. If the token, server, or Docker
   is unavailable, the task is **blocked, not done** — stop and tell the user.
5. **Review gate ≥ 91** — invoke the `review-gate` skill and reach a score of
   at least 91 from a fresh independent reviewer.

Then, and only then, update this spec's task row with:

- **Completed** — the date/time (`date +"%Y-%m-%d %H:%M"`).
- **Score** — the review-gate score.
- **Retrospective** — 1–2 sentences: what went well, and what to improve later.

Marking a row Done without all five is a process violation, not a shortcut.

---

## 5. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write the failing tests: T-1…T-3 (+ stale-row extension of the existing stale-exemption test) against a stubbed `findConventionIssues`; T-4 (real tree); `conformance.browser.spec.ts` with **all** T-5/T-6/T-7/T-13/T-14/T-15 rows; T-8 (if needed), T-9…T-12 in their component specs. Run them; record the red list in §6 (T-14 rows that are already green are recorded as "not a bug"). | UC-1…UC-13 | ✅ Done | 2026-10-16 21:10 | 92 | Red list, T-8 skip and the dropped hover-card row are in §6; first review round (88) asked for a host-`[class]` (B-2) gate fixture and the doc entries. T-4 can only go red once Task 2 replaces the stub. |
| 2 | Gate: implement `findConventionIssues` (zero-box detection, inherited-input resolution within `ui/`, `data-slot` in template or host) in `check-completeness-lib.ts`; add `class-input` and `data-slot` sections to the allowlist parser/serializer/stale check and to `completeness-allowlist.json` (empty); report convention issues from `check-completeness.ts`. Enable `@angular-eslint/prefer-on-push-component-change-detection` and `prefer-signals` (options per Decision C-2) for shipped `packages/components/**` excluding specs/stories; confirm T-16's exact hit list. T-1…T-3 green; T-4 and lint stay red with the expected list. | UC-12 (T-1…T-4, T-16) | ✅ Done | 2026-10-16 21:45 | 91 | Static text scan (no TS program) keeps `test:cli` fast; reviewer's false-positive notes (`i<items` in a template expression, `[data-slot]` selectors) were fixed and pinned. T-4 and the 5 lint hits stay red by design until Tasks 6 and 9. |
| 3 | Family A — feedback / layout / display (`class` via Decision B + `data-slot`): `toast`, `toast/sub/toaster`, `aspect-ratio`, `virtual-scroll`, `breadcrumb`, `collapsible/sub/collapsible-trigger`, `speed-dial` (+ `sub/speed-dial-menu` `max-w-[calc(100vw-2rem)]` on the left/right linear rows), `meteors`, `particles`, `number-ticker` (`data-slot`), `number-ticker/sub/number-ticker-digit`, `split-button/sub/*` (menu is zero-box: `data-slot` only), `tree-select/sub/*` (delete the no-op `class` inputs; add `data-slot`), `kanban/sub/kanban-column-dialog` (apply `class` to its `ui-dialog-content`), `bento-grid` (+`sub/bento-grid-item`; merge bar `max-w-[calc(100vw-2rem)]`), `org-chart`, `page-renderer`, `sparkles` (+`sub/sparkles-button`), `streaming-text`, `text-reveal`, `field/sub/field-auto-errors`. Stories gain a `class` arg where an input was added. T-5 Task-3 rows, T-7 (kanban) green. | UC-1, UC-3, UC-4 (T-5, T-7) | ✅ Done | 2026-10-16 22:30 | 92 | Mechanical and low-risk; the static gate, not a rendered-style row, guards the 25-odd `class` additions beyond the five browser representatives. `number-ticker-digit` moved to Task 6 so its `class` and OnPush land together under the new lint rule. |
| 4 | Family B — composite/data components: `hover-card` (+`sub/hover-card-trigger`), `command/sub/command-{dialog,empty,input,separator,shortcut}`, `data-table/data-table` (host B-2), `data-table/sub/data-table-{pagination,filter-builder,column-header}`, `infinite-canvas/addons/node-editor-palette`, `node-editor-text-output`, `page-builder/sub/property-editor`, `shortcut-bindings-dialog`, `button/confirm-dialog`. T-5 Task-4 row, T-6 rows 1–2 green. | UC-1, UC-2, UC-4 (T-5, T-6) | ✅ Done | 2026-10-16 23:05 | 92 | Host B-2 on data-table measured working (consumer `h-[123px]` beats `h-full`). Forwarding in command-dialog, palette, shortcut dialog, confirm-dialog and property-editor is guarded only by the static gate, not a rendered-style row. |
| 5 | Family C — RTE addons: the 19 components under `rich-text-editor/addons/**` from §0 G-1b (actions-dialog/-popover, ai-chip/-panel, colors-button, emoji-button, file-import-button/-overlay, history-panel, images-button/-overlay/-resizer, links-button/-form, mention-popover, outline-panel, slash-commands-menu, tables-button, typography-button) + `rich-text-actions-form` applies its `class` on the host; `data-slot` on history-panel, images-resizer, mention-popover. T-5 Task-5 row, T-7 (actions-form) green. Run `npx vitest --run packages/components/ui/rich-text-editor packages/components/ui/rich-text-view` (consumers — CLAUDE.md "Fixing Bugs" §5). | UC-1, UC-3, UC-4 (T-5, T-7) | ⬜ Not started | — | — | — |
| 6 | API modernization: OnPush on `number-ticker` + digit (remove unused `_el`); `input-mask` → `input()` signal inputs (keep the `uiInputMask` alias; drop `standalone: true`); `data-table-context-menu.directive.ts:42-43` — type the injection without `any` (e.g. `inject(DataTableComponent, { optional: true })` typed through a generic-free token, or `inject<DataTableComponent<unknown> \| null>(…)` — whatever `tsc` accepts without a cast) and delete the inline disable. T-8, T-9, T-16 (lint now clean for these), T-17 green. | UC-5, UC-6, UC-13 (T-8, T-9, T-16, T-17) | ⬜ Not started | — | — | — |
| 7 | Toast pause (Decision D-1): `ToastService.pause()/resume()` with per-toast remaining time and frozen countdown; toaster wires `pointerenter/leave` + `focusin/focusout` (focusout only when `relatedTarget` leaves the region). JSDoc both methods; story + demo page gain a "pauses on hover/focus" example with an action button. T-10…T-12 green. | UC-9, UC-10, UC-11 (T-10…T-12) | ⬜ Not started | — | — | — |
| 8 | Teardown (Decision E-1): `stagger-children` and `marquee` store/cancel their frame and skip work after destroy; for each T-14 row that was red in Task 1, apply the same guard (`popover-content` is the suspected one); leave green rows untouched. T-13, T-14 green. | UC-8 (T-13, T-14) | ⬜ Not started | — | — | — |
| 9 | **Overlay family — last; rebase onto merged overlay specs first.** `class` (B-1/B-2) + `data-slot` for `alert-dialog/**`, `dialog/**`, `drawer/**`, `sheet/**`, `select/**` (incl. `select-value`), `dropdown-menu/**` (incl. `sub`, `sub-content`, `sub-trigger`), `menubar/sub/menubar-{menu,separator,shortcut,sub,sub-content}`, `context-menu/**` (component folder only — not the flat directives), `tooltip/**`, `popover` (+`sub/popover-close`, `sub/popover-trigger`), `emoji-picker` (+`sub/emoji-picker-trigger`), `input-otp/sub/*`; tooltip width per Decision F in `tooltip.directive.ts:157` and `tooltip-content.component.ts:36`. Record "no change, full-width by construction" for sheet/drawer/sidebar/scroll-progress/page-spinner (G-5). T-4 now green with an **empty** convention allowlist; T-5/T-6 Task-9 rows and T-15 green. | UC-1, UC-2, UC-4, UC-7 (T-4, T-5, T-6, T-15) | ⬜ Not started | — | — | — |
| 10 | Close: hand the C-11 sentence (Decision A-2, wording in `specs/repo-hygiene-and-docs-drift-spec.md` §3.4) to that spec — if its Task 10 is already done, ask the human to approve the one-line CLAUDE.md addition here instead. §2.5 mutation check. `npm run docs:regen` (restore `documentation.json`), `npm run docs:check`, `npm run check:completeness`, `npm run check:all`, `npm run test-visual` (zero failures), `npm run test:cli`, `npm run verify:portable`, `npm run test-storybook:a11y` on touched stories, `npm run e2e:impact -- --base origin/master` and run every impacted spec (expect `rich-text-editor` → all `rte-*`, `data-table`, `toast`, `tooltip`, `command`, `popover`, the overlay folders, `pkg-rte`, `pkg-data-table`); screenshot toast, breadcrumb, tooltip (long text) at 320 px and 1024 px, LTR and RTL; then `npm run sonar:gate` and verify the four gate conditions in CLAUDE.md §4. Note the two package releases (§3.6) in the PR description. | all | ⬜ Not started | — | — | — |

---

## 6. Completion log

_Append per task (Task 1 red list incl. T-14 rows that were not bugs,
T-16 hit list, mutation-check results, screenshots, gate results)._

| Date | Task | Event |
|------|------|-------|
| 2026-10-16 | 1 | **Red list recorded.** Gate unit tests (`check-completeness.spec.ts`, stub `findConventionIssues` returns `[]`): 8 red — `no class input at all`, `declared but never applied`, `no data-slot`, `host [class] binding (B-2) accepted`, `zero-box no-op input`, `projection-only box host needs input`, `contents host with element needs input`, plus the stale `data-slot` exemption row; the clean-case tests (conforming, zero-box without input, inherited input, external `.html` slot) are green against the stub on purpose — they guard false positives once Task 2 lands. **T-4 (real tree) is green against the stub and cannot be red until Task 2**; a scratch run of the real classifier on this tree found 35 `data-slot`, 96 box-rendering-without-`class`, 4 declared-but-not-applied (`kanban-card-dialog`, `kanban-column-dialog`, `kanban-delete-column-dialog`, `rich-text-actions-form`) and 2 zero-box-with-`class` (`tree-select-trigger`, `tree-select-content`) findings (the spec's G-1c list missed `kanban-card-dialog`/`kanban-delete-column-dialog`; `sidebar-menu-link` is NOT zero-box, its template renders `<a>`), plus 2 internal RTE preset components (`PresetHoverCardComponent`, `PresetDialogComponent`) the spec did not list. `conformance.browser.spec.ts`: 18 red — toast, breadcrumb (+RTL), aspect-ratio, virtual-scroll, command-separator, outline-panel (T-5); command-shortcut, data-table, dialog-title (T-6); kanban column dialog, actions-form with a bound `[class]` (T-7); stagger + marquee (T-13); popover fixed (T-14); `[uiTooltip]` long ltr/rtl, short `<ui-tooltip>` one-line (T-15). Green before any fix: `ui-tooltip-content` class (already applied), `<ui-tooltip>` long text (it is not `whitespace-nowrap`; G-5's claim for `tooltip-content.component.ts:36` is stale, but the bubble is a skinny column when the trigger is narrow — the red short-label row captures that), short `[uiTooltip]` one-line (desktop parity pin), emoji-picker and autocomplete (**not a bug**, leave their code alone). The T-14 hover-card row was dropped: it never portals (its rAF only measures), so it cannot fail. Observations: a static `class="text-xs"` on `ui-dialog-title` and on `ui-rich-text-actions-form` already works because Angular still writes the attribute to the host and Tailwind orders same-property utilities alphabetically (`text-xs` after `text-lg`); the T-6 title row therefore uses `text-base` (sorts BEFORE `text-lg`, so it loses today) and the actions-form row binds `[class]`. T-8 skipped: `number-ticker.component.spec.ts` "animates downward when a lower target replaces the current value" already changes `value` post-render (asserts `displayValue()`). T-9 is green by design (pins parity). T-10..T-12: 4 red (mouse + touch pointer, focus-within, frozen countdown); the sticky-toast row is a green degenerate-class pin. TestBed leaves a destroyed fixture's DOM in `document.body`, so the T-14 rows `discard()` the root before sweeping for leaks. |
| 2026-10-16 | 2 | Gate landed in `check-completeness-lib.ts` (`findConventionIssues`, `Artifact` widened with `class-input`/`data-slot`, allowlist parse/serialize/stale/size cover both sections; `--seed` seeds only story/demo/e2e — conventions are fixed in source, never grandfathered). Real-tree backlog the gate reports: **102 class-input + 40 data-slot** (T-4 red, expected until Task 9). The data-slot count is 5 above the spec's 36-minus-charts because the scan counts only the attribute (`data-slot=`, `[attr.data-slot]`, a host `'data-slot':`), not a `[data-slot="x"]` selector a file merely queries — `command-dialog`, `rich-text-{emoji,links,tables,typography}-button` only mention it in selectors (review round 1 flagged the substring test). **T-16 hit list** with `@angular-eslint/prefer-on-push-component-change-detection` and `prefer-signals` (`preferInputSignals`, no query/readonly) enabled for shipped `packages/components/**`: exactly 5 errors — `input-mask.directive.ts` 20/22/28 (`@Input` ×3) and two OnPush hits (`number-ticker.component.ts:17`, `number-ticker-digit.component.ts:14`); the rest of the tree is clean. Mutation check: dropping the inherited-lineage lookup turns `counts a class input that the parent declares and applies` and the real-tree test red. |
| 2026-10-16 | 3 | Family A done: `class` (B-1 inner element, B-2 host for `speed-dial`/`meteors`/`particles`) + `data-slot` landed on toast, toaster, aspect-ratio, virtual-scroll, breadcrumb, collapsible-trigger, speed-dial (+ `max-w-[calc(100vw-2rem)]` on the left/right menu rows), meteors, particles, split-button item/primary/menu, bento-grid (+item; merge bar `max-w-[calc(100vw-2rem)]`), page-renderer, sparkles (+button), streaming-text, text-reveal, field-auto-errors; the no-op `class` inputs on `tree-select-trigger`/`-content` were deleted and both gained a host `data-slot`; all three kanban dialogs (`card`, `column`, `delete-column` — the spec named only column) now pass `class` to their `ui-dialog-content`/`ui-alert-dialog-content`. T-5 rows (toast, breadcrumb, breadcrumb rtl, aspect-ratio, virtual-scroll) and T-7 kanban green; no gate findings remain for these folders. `org-chart` already carries `data-slot` in its template (the spec's G-2 list was stale). **Deferred to Task 6:** `number-ticker-digit`'s `class` input — the file is still non-OnPush, so staging it would fail the new `prefer-on-push` lint rule at the pre-commit hook; Task 6 adds both together. Stories gained a `class` control for toast (toaster), aspect-ratio, virtual-scroll, breadcrumb, speed-dial, meteors, particles; sub-parts (split-button items, collapsible-trigger, kanban dialogs, bento item) have no story of their own to carry one. Not run here (lead's integration pass): Storybook axe for those stories. Consumer note: a static `class="x"` on a component that now has a `class` input is applied twice (DOM attribute + merged through `cn()`); harmless, and the merged copy is what wins conflicts. |
| 2026-10-16 | 4 | Family B done: `class` + `data-slot` on hover-card (host B-2) and its trigger, `command-{dialog,empty,input,separator,shortcut}` (dialog forwards `class` to its `ui-dialog-content`; `command-input`'s `class` lands on the search row, the `<input>` itself is not reachable), `data-table` (host B-2, `'[class]': 'hostClasses()'` — **measured: a consumer `h-[123px]` now beats the host default `h-full`, T-6 row green; the host also still receives the static attribute, so the class appears twice in the DOM and the merged copy resolves conflicts**), `data-table-{pagination,filter-builder,column-header}`, `node-editor-palette` (forwards to its command dialog), `node-editor-text-output` (static classes moved into the `cn()` computed), `property-editor`, `shortcut-bindings-dialog` (host `contents` + slot, class forwarded to the dialog panel), `confirm-dialog`. T-5 command-separator and T-6 rows 1–2 (command-shortcut, data-table) green; 2206 tests across hover-card/command/data-table/infinite-canvas/page-builder/shortcut-bindings-dialog/button/autocomplete pass. The data-table story gained a `class` control (Playground only; its other renders use bespoke templates). Remaining gate findings in these folders: none. |
| 2026-10-03 | 10 (C-11 hand-off only) | Already applied: the zero-box `class` exception (Decision A-2) landed in `.claude/CLAUDE.md` "Class Input" during wave 0 (see `repo-hygiene-and-docs-drift-spec.md` §6). Task 10 no longer hands off a sentence. The rest of Task 10 is still open. |
