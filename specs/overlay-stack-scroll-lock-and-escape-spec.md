# Overlay Stack — Scroll Lock, Escape and Focus — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **Sibling spec:** `specs/keyboard-and-touch-activation-spec.md` (also no
> prerequisites). The two can run in parallel — they touch **disjoint source
> files** (conflict map in §5.3). Both append tests to
> `dropdown-menu.component.spec.ts`, `menubar.component.spec.ts` and
> `context-menu.component.spec.ts`, and both regenerate `registry.json`; on
> merge keep both sides of the spec files and **regenerate** the registry
> (`npm run check:registry -- --fix`), never hand-merge it.

---

## 0. Step 0 — findings verified against the source (2026-10-03)

Every finding below was re-read in the component **and** its spec file before
it was written into this spec. ✓ = confirmed as reported. ⚠️ = the report was
wrong or incomplete; *believed* vs. *true* is stated. Line numbers are against
`docs/codebase-review-fix-specs` @ `6fae7f7f`.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| F-1 | `ui-dialog-content` clears body scroll whenever its effect runs while closed | ✓, with one refinement | `dialog/sub/dialog-content.component.ts:69-84` — the `else` branch writes `document.body.style.overflow = ''`, and so does `onCleanup` (which runs before every re-run, i.e. on every open/close). ⚠️ *Believed:* "dialog-content is projected so it exists while closed, so a closed dialog inside an open sheet unlocks the page." *True:* projected content is created eagerly with the **declaring** template, so the clobber fires when the closed dialog is **created** — which unlocks an already-open sheet only when the dialog is created *after* the sheet opened (inside an `@if`/`@for`, a lazily rendered tab, a child component swapped in). The nested-confirm case needs no such condition: closing an inner dialog always clears the lock the outer modal still needs. |
| F-2 | `ui-sheet` / `ui-drawer` unlock unconditionally | ✓, and worse | `sheet/sheet.component.ts:63-72` and `drawer/drawer.component.ts:69-78`: the constructor effect runs `unlockScroll()` on its **first run while closed**, so merely *creating* a closed sheet/drawer clears an open dialog's lock — not only destroying it (`sheet.component.ts:77-80`, `drawer.component.ts:83-86`). `unlockScroll` writes `''` to `overflow` **and** `paddingRight` (`sheet:89-93`, `drawer:94-98`), clobbering any inline value the consumer had. |
| F-3 | SSR: dialog-content touches `document.body` while closed; sheet/drawer inject `DOCUMENT` | ⚠️ partly | Dialog: ✓ — global `document` in an effect (`dialog-content.component.ts:71-82`). *Believed:* sheet/drawer are SSR-safe because they inject `DOCUMENT`. *True:* both read `globalThis.window.innerWidth` **in the constructor** (`sheet.component.ts:61`, `drawer.component.ts:67`), which throws on the server before any lock logic runs. |
| F-4 | `ui-alert-dialog` and scroll lock | ⚠️ new | Not in the report. `alert-dialog/alert-dialog.component.ts:18-45` never locks body scroll and never registers with `OverlayStackService` — a modal (`role="alertdialog"`, no backdrop dismissal) that lets the page scroll behind it and is invisible to the Escape stack. |
| F-5 | Escape closes the popup **and** the modal it sits in | ✓, class is wider | Registered with the stack today: dialog, sheet, drawer, popover only (`grep OverlayStackService`). Confirmed double-close (handler calls only `preventDefault`, the event bubbles on to the modal's panel handler, which never checks `defaultPrevented`): data-driven select `select.component.ts:588-591`; projected select via the document listener `select.component.ts:269-273` (runs *after* the dialog's panel handler); `dropdown-menu-content.component.ts:91-94`; `menubar-content.component.ts:65-68`; `alert-dialog-content.component.ts:188-192` (an alert dialog nested in a dialog closes both); `context-menu.component.ts:117-121` (document listener, after the dialog). **Added:** `split-button.component.ts:362-365`; `eyedropper.component.ts:245-251` (fallback sampler's `window` listener — the dialog's handler runs first); `emoji-picker` has **no** Escape handling at all, so Escape skips it and closes the enclosing modal; `dropdown-menu-sub-content.component.ts:117-121` and `context-menu-sub-content.component.ts:224-228` only `preventDefault`, so Escape in a submenu also closes the root menu (and the modal under it). **Checked, not affected:** autocomplete, tree-select, color-picker (built on `ui-popover`, already registered); command (stops propagation for page-back, `command-input.component.ts:107-111`); time-picker (no popup). **Checked, out of scope:** hover-card and navigation-menu have no Escape handling at all (documented, `navigation-menu.component.ts:87`) — adding it is a feature. |
| F-6 | Date-picker Escape | ⚠️ moved here from the sibling spec | `date-picker.component.html:27-28` and `date-range-picker.component.html:29-30` stop **every** keydown at the popup, so Escape inside the calendar does nothing; Escape on the trigger while the popup is open closes the enclosing modal with the picker still open. Escape is an overlay-stack concern, so it lives here; the sibling spec cross-references it. |
| F-7 | Date-picker outside click matches **any** picker | ✓, moved here | `date-picker.component.ts:253-258` and `date-range-picker.component.ts:180-185` test `target.closest('[data-slot="date-picker"]')` (resp. `date-range-picker`), which matches picker B's wrapper too — opening B leaves A open. Moved into this spec so all date-picker edits live in one spec (no cross-spec file conflict). The existing tests (`date-picker.coverage.spec.ts:282-295, 502-511`) only use a detached `div` as "outside" — a degenerate input that cannot catch it. |
| F-8 | Focus trap lets Tab escape when the last button is disabled | ⚠️ corrected | `dialog-content.component.ts:141-159` (and `sheet-content:159-175`, `drawer-content:113-130`, `alert-dialog-content:194-212`) build the ring from `'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'`, which includes disabled, `tabindex="-1"` and hidden controls. *Believed:* a disabled last button lets Tab escape a `ui-dialog`. *True for dialog and sheet only in the **backward** direction:* both render their enabled corner close button **after** `<ng-content>` (`dialog-content.component.html:29-39`, `sheet-content.component.ts:59-69`), so it is always the last element; the escape happens on **Shift+Tab** when the first match is disabled, roving (`tabindex="-1"`, e.g. a calendar's day buttons) or hidden. **Forward** escape is real in `alert-dialog` (no close button — a "type DELETE to confirm" action disabled until valid is last) and `drawer` (no close button). |
| F-9 | Opening a modal can leave focus outside it | ⚠️ new | `sheet-content.component.ts:130-143`, `drawer-content.component.ts:69-82`, `alert-dialog-content.component.ts:166-179` focus the first match of a selector **without** `:not([disabled])`. If that is a disabled button, `focus()` is a no-op and focus stays on the trigger **outside** the modal, where the trap's keydown handler (bound on the panel) never sees Tab. Dialog's own first-focus query does exclude `disabled` (`dialog-content.component.ts:97-99`) but not hidden/inert. |
| F-10 | Data-driven `ui-select` drops focus to `<body>` on close/commit | ✓, class is wider | The listbox is inside `@if (open())` (`select.component.ts:76`) and nothing restores focus; projected mode does (`select-content.component.ts:75-79`). Same class found in: `ui-dropdown-menu` item activation — `dropdown-menu-item.component.ts:70-74` → `DropdownMenuComponent.hide()` (`dropdown-menu.component.ts:188-190`), focus is restored only on Escape (`dropdown-menu-content.component.ts:94`); `ui-menubar` item activation (`menubar-item.component.ts:80-85` → `menu.close()`); `ui-split-button` Escape (its own JSDoc admits it, `split-button.component.ts:339-342`). Inside a modal, focus on `<body>` means the modal's panel handlers never see Tab or Escape again. |
| F-11 | `ui-select` is marked touched by any page click | ✓ | `clickListener` (`select.component.ts:263-267`) calls `close()` for every outside click, open or not, and `close()` always calls `_onTouched()` (`select.component.ts:427-430`). No spec covers touched state (`grep -n touched select/*.spec.ts` → none). |
| F-12 | Tests reset leaked body styles by hand | ✓ evidence | `document.body.style.overflow = ''` in `afterEach` of `dialog.component.spec.ts:267,310,326,394,464`, `sheet.component.spec.ts:59,97,280,368,445`, `drawer.component.spec.ts:49,80`, `drawer.coverage.spec.ts:57,121,156,163,245` and three browser specs — the suite has been cleaning up after the leak instead of catching it. |
| F-13 | `ui-dialog` panel has no `role="dialog"` / `aria-modal` | ⚠️ new — **out of scope**, recorded | `dialog-content.component.html:12-18`. Adding the role needs an accessible name (axe `aria-dialog-name`) and a Sonar `Web:S6819` exclusion like the drawer's (`docs/sonarqube-accepted-findings.md:69-73`); that is its own small spec. |

---

## 1. Product Manager section

### 1.1 Business logic

Modal and popup overlays share three global resources: the page's scroll, the
Escape key and keyboard focus. Today each overlay manages them alone, so any
two overlays on screen at once fight over them. This spec makes the overlay
stack (`lib/overlay-stack.service.ts`, already the arbiter for Escape between
dialog/sheet/drawer/popover) the **single owner** of all three:

1. **Scroll lock** — the page is locked while at least one modal is open, and
   the body's own styles come back exactly as they were when the last one
   closes.
2. **Escape** — one key press closes exactly one overlay: the topmost.
3. **Focus** — Tab cannot leave an open modal, opening a modal puts focus
   inside it, and closing any overlay that held focus hands it back to the
   element that opened it.

Plus two small defects found in the same files: a `ui-select` that marks its
form control touched on unrelated clicks, and date pickers that do not close
each other.

### 1.2 Why the customer wants this

The consuming developer's real screens nest overlays: an "Edit customer" sheet
with a "Delete customer?" alert dialog in it; a dialog form with a country
`ui-select`, a date picker and a "More" dropdown in its footer. Today:

- **The user loses their form.** Pressing Escape to dismiss the country list
  closes the select *and* the dialog, discarding everything typed. The
  workaround is to stop the dialog from closing on Escape at all, or to wrap
  every popup in a `(keydown.escape)="$event.stopPropagation()"` element — on
  every screen, forever.
- **The page scrolls behind a modal.** Closing the nested confirm dialog
  unlocks the page under the still-open sheet; route changes and conditionally
  rendered sheets unlock open dialogs. The workaround is a hand-rolled
  ref-counter on `document.body` that fights the library's own writes.
- **The consumer's own body styles are erased.** An app that sets
  `body { overflow-y: scroll }` inline (to stop layout jumping) loses it the
  first time any sheet is merely *created*.
- **Keyboard users get stuck or escape.** A "type DELETE to confirm" alert
  dialog lets Tab walk out onto the page behind it; picking a select option
  inside a dialog drops focus to `<body>`, after which Escape and Tab no longer
  reach the dialog at all.
- **Forms show errors too early.** A required `ui-select` turns red the moment
  the user clicks anywhere on the page, before ever touching it.

### 1.3 Use cases — definition of done

Scroll lock

- **UC-1** Opening any modal — `ui-dialog`, `ui-sheet`, `ui-drawer` or
  `ui-alert-dialog` — locks page scroll.
- **UC-2** With two modals open in any nesting (dialog in sheet, alert dialog
  in dialog, dialog in dialog, drawer in dialog), closing the inner one leaves
  the page locked; closing the last one unlocks it.
- **UC-3** Creating or destroying a **closed** modal — rendered by an `@if`,
  torn down by a route change — never changes the body's styles.
- **UC-4** Inline `overflow` and `padding-right` that the consumer had set on
  `<body>` before the first modal opened are restored exactly after the last
  modal closes.
- **UC-5** When the page has a classic scrollbar, locking adds that width to
  the body's existing right padding, so content does not jump sideways; when
  there is no scrollbar, padding is untouched.
- **UC-6** Rendering a modal on the server (an injected `DOCUMENT` with no
  `defaultView`) does not throw, and touches no global `window`/`document`.

Escape

- **UC-7** Escape inside a popup that sits in a modal — data-driven and
  projected `ui-select`, `ui-dropdown-menu`, `ui-menubar`, `ui-context-menu`,
  `ui-popover`, `ui-date-picker`, `ui-date-range-picker`, `ui-split-button`,
  `ui-emoji-picker`, `ui-eyedropper` (fallback pick mode) — closes only the
  popup; the modal and its form stay.
- **UC-8** Escape in a modal nested in a modal closes only the inner modal.
- **UC-9** Escape that a component consumes for its own purpose (calls
  `preventDefault()` — a submenu closing back to its parent, a data-table
  clearing its cell range, a consumer's own inline editor) closes no overlay.
- **UC-10** Escape closes the topmost overlay wherever focus is — including
  `<body>` and a trigger outside the overlay's panel.
- **UC-11** Escape pressed while an IME composition is active closes nothing.

Focus

- **UC-12** Tab and Shift+Tab never move focus out of an open modal — including
  when its first or last control is disabled, `tabindex="-1"`, or hidden.
- **UC-13** Opening a modal moves focus to its first *enabled, visible* control
  (or the panel itself if there is none) — never leaves it on the trigger.
- **UC-14** Closing a modal returns focus to the element that opened it
  (existing behaviour — kept, now proven for nested modals).
- **UC-15** Committing or dismissing a popup that held focus — a data-driven
  `ui-select` option, a `ui-dropdown-menu` item, a `ui-menubar` item, a
  `ui-split-button` menu, any popup closed by Escape — returns focus to its
  trigger, never to `<body>`.

Other

- **UC-16** A `ui-select` bound to a form becomes touched only when the user
  closed it after opening it (or blurred it) — never from a click elsewhere on
  the page while it is closed.
- **UC-17** Opening date picker B closes date picker A, for every pairing of
  `ui-date-picker` and `ui-date-range-picker`.
- **UC-18** Overlays from the compiled `@gilav21/shadcn-angular-rte` /
  `-data-table` packages and CLI-installed overlays on the same page share one
  stack — Escape and the scroll lock behave as if there were one copy.

The spec is done when, and only when, every UC above demonstrably passes.

### 1.4 Explicitly out of scope

- `role="dialog"` / `aria-modal` / accessible name on `ui-dialog` (F-13) — its
  own spec.
- Escape for hover-card, navigation-menu and tooltip (WCAG 1.4.13 asks for it on
  hover content) — a feature, not a fix of this class.
- The rich-text editor's **internal** overlays (slash menu, mentions, links,
  AI panel, history, find/replace, action presets — eight Escape handlers).
  They gain nothing from being half-migrated; the ones that already
  `preventDefault` become correct for free under UC-9. A follow-up spec should
  register them as layers.
- Mobile `ui-sidebar` as a modal layer (it has its own Escape/Tab handling,
  `sidebar.component.ts:135-160`).
- Speed-dial, tour, toast.
- Keyboard **activation** of menu items, context-menu keyboard navigation,
  touch long-press and tooltips — `keyboard-and-touch-activation-spec.md`.
- RTL scrollbar on the left (Firefox with `dir="rtl"` on `<html>`): the
  compensation keeps using `padding-right` as today; recorded in R-6.
- iOS Safari's body-scroll quirks (`overflow: hidden` on `<body>` not stopping
  touch scroll on old iOS) — no change in approach.

---

## 2. QA section — write these tests FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.
> This is the mechanism that keeps implementation honest against the PM
> section.

Follow `.claude/CLAUDE.md` › "Writing Tests": one test per behaviour, table
rows for input classes, real-shaped inputs, assert the outcome through the DOM
or public API.

### 2.1 Where each test lives — and why

All twenty components touched here are **portable-verified**
(`packages/components/portable-tests.json`): every non-browser `*.spec.ts` in
their folders ships to consumers and must also pass in **jsdom** (the
`verify:portable` leg). Therefore:

- **Cross-component tests** (a select *in* a dialog) go in `*.browser.spec.ts`
  — they import other components' barrels and must never ship.
- **Native focus movement** (real Tab) and anything using layout
  (`checkVisibility`) go in `*.browser.spec.ts`, driven by
  `userEvent.keyboard` from `vitest/browser` (precedent:
  `select/select.component.browser.spec.ts:6,136-145`).
- **The service** is tested in `lib/overlay-stack.service.spec.ts` (lib specs
  run in the browser leg only).
- Single-component logic that is jsdom-safe stays in that component's
  `*.spec.ts`.

### 2.2 Traceability

| Test ID | Test name | File | Proves | Type |
|---|---|---|---|---|
| T-1 | `locks the body while any modal layer is registered and restores its prior inline styles after the last` | `lib/overlay-stack.service.spec.ts` | UC-1, UC-2, UC-4 | unit |
| T-2 | `adds the scrollbar width to the existing right padding, and nothing when there is no scrollbar` | `lib/overlay-stack.service.spec.ts` | UC-5 | unit |
| T-3 | `locks and unlocks against a document with no defaultView` | `lib/overlay-stack.service.spec.ts` | UC-6 | unit |
| T-4 | `Escape dismisses exactly the top layer, wherever focus is` | `lib/overlay-stack.service.spec.ts` | UC-8, UC-10 | unit |
| T-5 | `Escape that was preventDefault-ed, or arrives mid-composition, dismisses nothing` | `lib/overlay-stack.service.spec.ts` | UC-9, UC-11 | unit |
| T-6 | `two service instances on one document share one stack and one lock` | `lib/overlay-stack.service.spec.ts` | UC-18 | unit |
| T-7 | `the body lock survives every way a second modal can come and go` | `dialog/overlay-nesting.browser.spec.ts` | UC-1, UC-2, UC-3 | component (browser) |
| T-8 | `Escape inside a popup closes only that popup, never the modal around it` | `dialog/overlay-nesting.browser.spec.ts` | UC-7, UC-8, UC-15 | component (browser) |
| T-9 | `Escape in a submenu closes only the submenu` | `dialog/overlay-nesting.browser.spec.ts` | UC-9 | component (browser) |
| T-10 | `Tab and Shift+Tab stay inside the modal whatever its edge controls are` | `dialog/overlay-nesting.browser.spec.ts` | UC-12 | component (browser) |
| T-11 | `opening a modal focuses its first enabled, visible control` | `dialog/overlay-nesting.browser.spec.ts` | UC-13, UC-14 | component (browser) |
| T-12 | `tabbableElements keeps only what Tab can reach` | `lib/a11y.spec.ts` | UC-12, UC-13 | unit (browser leg) |
| T-13 | `a popup that held focus returns it to its trigger when committed or dismissed` | `dialog/overlay-nesting.browser.spec.ts` | UC-15 | component (browser) |
| T-14 | `marks the form control touched only after the user closed the popup` | `select/select.component.spec.ts` | UC-16 | component |
| T-15 | `opening one picker closes every other open picker` | `date-picker/date-picker.component.browser.spec.ts` | UC-17 | component (browser) |
| T-16 | e2e `overlay-stack`: dialog form with a select, a date picker and a nested alert dialog — Escape ×3, Tab wrap, page does not scroll behind | `e2e/harness/overlay-stack/overlay-stack.spec.ts` | UC-2, UC-7, UC-8, UC-12, UC-15 | e2e |

Every UC appears at least once. UC-6 has no SSR harness in this repo; T-3
proves it at the service, and the code rule in §3.2 (no `globalThis.window`
outside the service's lock path) is checked by review.

### 2.3 What each test samples — the input classes

- **T-1** — a body with consumer inline `overflow: clip; padding-right: 12px`
  and a body with no inline styles (two classes). Sequence: modal A, non-modal
  P, modal B, unregister A (still locked), unregister P, unregister B
  (restored). A non-modal layer alone must not lock.
- **T-2** — fake document: `innerWidth 1280 / clientWidth 1263` (17px
  scrollbar) with computed `padding-right: 12px` → `29px`; `1280 / 1280` → the
  inline value untouched. **Measure first:** headless Chromium in this runner
  may hide scrollbars, so geometry cannot be asserted in the browser; that is
  why this is a fake-document unit test. Record the measured width in the
  completion log.
- **T-3** — `DOCUMENT` stub `{ body, documentElement, defaultView: null }`;
  lock/unlock must not throw and must not read `globalThis.window` (spy on a
  temporarily-replaced `globalThis.innerWidth` getter and assert it was never
  read).
- **T-4** — stack `[dialog, popover, dialog]`, Escape dispatched from (a) an
  input inside the top layer, (b) `document.body`, (c) an element outside every
  layer. Each press dismisses exactly one layer, top-down.
- **T-5** — an Escape whose `defaultPrevented` is set by a handler on the way up
  (a plain element listener standing in for a submenu / data-table range
  clear); an Escape with `isComposing: true`; a non-Escape key. None dismisses.
- **T-6** — two `OverlayStackService` instances built on the same document:
  register on one, Escape/lock observed through the other. (Stands in for two
  bundled copies of the class — the state must live on the document, not the
  instance.)
- **T-7** — real components, one table row each, every modal kind appearing at
  least once as outer and inner:
  1. sheet open → a closed `ui-dialog` created by flipping an `@if` → still locked;
  2. dialog → nested dialog opened then closed → still locked;
  3. dialog open → a closed `ui-sheet` destroyed via `@if` → still locked;
  4. sheet → `ui-alert-dialog` opened (locks) then closed → still locked;
  5. drawer → closed → body back to the consumer's inline `overflow-y: scroll`;
  6. a closed `ui-drawer` and `ui-sheet` created on a page with consumer inline
     body styles → styles untouched (UC-3).
- **T-8** — table-driven over rows, each popup kind once, outer modal rotating
  so each modal kind is the container at least twice. A real-shaped form: name
  input, email input, the popup, Cancel, Save (disabled until valid). Per row:
  open popup, press Escape (via `userEvent.keyboard`) **with focus where a user
  has it** (inside the popup panel where the popup moves focus; on the trigger
  where it does not — popover, date-picker trigger), then assert: popup closed,
  modal still open, the typed name still in the input, focus on the popup's
  trigger (context-menu row: focus on the right-clicked target — before the
  sibling spec lands focus never leaves it; after, the sibling's close path
  restores it there). Rows: data-driven select / sheet; projected select / dialog;
  dropdown-menu / drawer; menubar / dialog; context-menu / alert-dialog;
  popover / sheet; date-picker (focus in calendar) / dialog; date-range-picker
  (focus on trigger) / drawer; split-button / dialog; emoji-picker / sheet;
  eyedropper fallback pick (stub `EyeDropper` undefined, `fallbackTarget` set)
  / dialog; nested alert-dialog / dialog (UC-8).
- **T-9** — dropdown-menu submenu open inside a dialog: Escape → submenu closed,
  root menu open, dialog open; Escape → root closed; Escape → dialog closed.
  Same three-step shape for context-menu submenu.
- **T-10** — rows (modal × edge class), each modal kind and each edge class at
  least once: alert-dialog whose last control is a disabled "Delete" (forward
  Tab); drawer whose last control is a disabled "Submit" (forward); dialog whose
  first focusable is a `ui-calendar` with roving `tabindex="-1"` day buttons
  (Shift+Tab); sheet whose first button is disabled (Shift+Tab); drawer whose
  last section is `hidden`/`display:none` (forward); dialog with all controls
  enabled (baseline). Press the key 1×, then N+2 times, and assert
  `document.activeElement` is inside the panel after every press.
- **T-11** — alert-dialog, sheet and drawer whose **first** button is disabled:
  focus lands on the first enabled control inside the panel; a modal whose only
  controls are disabled focuses the panel. Close → focus back on the trigger;
  for dialog-in-dialog, closing the inner returns focus to the button inside
  the outer that opened it.
- **T-12** — one fixture containing: enabled/disabled button, `fieldset[disabled]`
  child input, `tabindex="-1"` button, `tabindex="0"` div, `<a>` with and
  without `href`, `hidden` input, `display:none` and `visibility:hidden`
  buttons, an `inert` subtree, a radio group of three (only the checked one is
  tabbable; first one when none is checked), `contenteditable`. Assert the exact
  list, in order. In jsdom `checkVisibility` is absent → hidden elements are
  treated as visible (asserted separately so the fallback is deliberate).
- **T-13** — rows: data-driven select option committed with Enter; dropdown
  item activated with Enter; menubar item activated with Enter; split-button
  menu closed with Escape. Each inside a dialog; after the commit, assert
  `document.activeElement` is the trigger **and** a following Escape closes the
  dialog (proving focus is back where the dialog can hear it).
- **T-14** — reactive `FormControl` with `Validators.required`, data-driven and
  projected: (a) click elsewhere on the page while closed → `untouched`;
  (b) open, click outside → `touched`; (c) open, Escape → `touched`;
  (d) pick an option → `touched` and `dirty`.
- **T-15** — rows: picker/picker, range/range, picker→range, range→picker. Open
  A, click B's trigger (real `userEvent.click`), assert A's popup is gone and
  B's is open. Also: a click inside A's own popup keeps A open (the class that
  must not regress).
- **T-16** — e2e against a real consumer install (multi-component install, see
  §3.4.4 for the `EXPLICIT_SPECS` entry): a dialog form whose body is taller
  than the viewport; open select → Escape → dialog still open and form value
  kept; open date picker → Escape → same; open nested alert dialog → Escape →
  outer dialog still open; Tab ×(N+2) never leaves the dialog; `window.scrollY`
  unchanged after `mouse.wheel` while open; closing everything restores
  scrolling.

### 2.4 Existing tests to fix or delete (do this in Task 1, same commit)

Per "Writing Tests › When a bug gets past the tests":

- **Fix** `lib/overlay-stack.service.spec.ts` (3 tests) — they test
  `hasOverlayAbove`, which this spec replaces; rewrite as T-4/T-6, delete the
  originals.
- **Fix** the per-component Tab-trap tests that call `onKeydown` directly with
  hand-built events and all-enabled buttons (`dialog.component.spec.ts:367-411,
  448-481`, `sheet.component.spec.ts:384-421`, `drawer.coverage.spec.ts:220-310`,
  `alert-dialog.component.spec.ts:366-401`): they sampled only the degenerate
  all-enabled class and never press a real Tab. T-10/T-12 replace them; delete
  the ones T-10 now covers (keep one jsdom-safe wiring test per component that
  asserts the panel's keydown reaches the shared trap, so the shipped portable
  spec still covers the wiring).
- **Delete** every `document.body.style.overflow = ''` / `paddingRight = ''`
  reset in `afterEach` (F-12). After the fix they must be unnecessary; if a test
  then fails because the body stays locked, a fixture is leaking an open modal —
  fix the fixture, do not restore the reset.
- **Fix** `date-picker.coverage.spec.ts:282-295, 502-511` — the "outside" target
  is a detached `div`; T-15 samples the real class (another picker).

### 2.5 Edge cases the tests must cover

Empty modal (no focusable control) — T-11. Single control — T-10 baseline row.
Disabled — T-10, T-11. RTL — run T-8's dropdown row and T-10's alert-dialog row
inside `dir="rtl"` (focus order and Escape are direction-independent; this
proves it). Touch-only — out of this spec (no touch behaviour changes here).
Error state — T-14 (required validator). Very large input — not applicable.

### 2.6 Coverage expectation

No uncovered lines in `lib/overlay-stack.service.ts` and the new `lib/a11y.ts`
helpers. Every other touched file keeps or raises its current line and branch
coverage; deleted Escape branches must not leave dead code behind.

### 2.7 Mutation checks (before marking any task done)

Back up, break, run, restore — never commit a break. Each must turn a test red:
make `unlock` restore `''` instead of the saved value (T-1, T-7 row 5);
lock on non-modal layers (T-1); dismiss every layer on one Escape (T-4);
drop the `defaultPrevented` guard (T-5, T-9); drop the `isComposing` guard (T-5);
key the state on the instance instead of the document (T-6); revert
`tabbableElements` to the old selector (T-10, T-12); remove a popup's
`registerLayer` call — try select and context-menu (T-8); remove the focus
restore from `DropdownMenuComponent.hide` (T-13); revert the
`if (this.open())` guard in select's click listener (T-14); revert the
`closest` check to the shared selector (T-15).

---

## 3. Architecture

### 3.1 The invariants — the rules this spec implements

1. **Scroll:** *Body scroll is locked iff at least one modal overlay is open,
   and closing the last one restores body styles to exactly what they were
   before the first opened.*
2. **Escape:** *Escape closes exactly the topmost open overlay — never the one
   beneath it.*
3. **Focus:** *Focus never leaves an open modal via Tab, and returns to the
   invoking element when it closes.* Corollary used by Task 5: *a popup that is
   torn down while it holds focus hands focus to its trigger.*

### 3.2 Usability — the API

Nothing changes for a consumer's templates. Simple mode and custom mode of every
overlay are untouched:

```html
<!-- Simple mode: unchanged -->
<ui-dialog [(open)]="editing">
  <ui-dialog-content title="Edit customer">
    <ui-select [options]="countries" formControlName="country" />
    <ui-date-picker formControlName="since" />
  </ui-dialog-content>
</ui-dialog>

<!-- Custom mode: unchanged -->
<ui-sheet>
  <ui-sheet-trigger><ui-button>Edit</ui-button></ui-sheet-trigger>
  <ui-sheet-content>
    <ui-alert-dialog>
      <ui-alert-dialog-trigger><ui-button variant="destructive">Delete</ui-button></ui-alert-dialog-trigger>
      <ui-alert-dialog-content>…</ui-alert-dialog-content>
    </ui-alert-dialog>
  </ui-sheet-content>
</ui-sheet>
```

What a consumer *observes* changing is exactly the UC list. One visible
difference to call out in the changelog: `ui-dialog` now compensates for the
scrollbar like sheet and drawer always did (UC-5), and `ui-alert-dialog` now
locks scroll (UC-1).

**Library-internal API** (`lib/overlay-stack.service.ts`), which component
authors and a future RTE migration use:

```ts
/** One open overlay, as the stack sees it. */
export interface OverlayLayer {
    /** Close the overlay (and hand focus back). Called by the stack on Escape when this layer is topmost. */
    readonly dismiss: () => void;
    /** Modal layers lock body scroll while registered. */
    readonly modal: boolean;
}

@Injectable({ providedIn: 'root' })
export class OverlayStackService {
    /** Put `layer` on top (moving it if already registered). Returns its unregister function. Idempotent. */
    register(layer: OverlayLayer): () => void;
    /** Whether `layer` is the topmost registered layer. */
    isTopmost(layer: OverlayLayer): boolean;
}

/**
 * Register `layer` for as long as `isOpen()` is true, and on destroy.
 * Must be called in an injection context (a constructor or field initialiser).
 */
export function bindOverlayLayer(isOpen: () => boolean, layer: OverlayLayer): void;
```

`hasOverlayAbove` / `push` / `remove` are **removed**, not kept beside the new
API (pre-1.0 policy: no compatibility scaffolding; `tsc` finds the call sites —
there are seven, all in this spec's files).

Rules the implementation follows:

- The service reads `inject(DOCUMENT)` only. `defaultView` is read **at lock
  time**; with no view there is no compensation. No component in this spec may
  read `globalThis.window` / global `document` in a constructor or an effect
  that runs while closed (removes `sheet.component.ts:61`,
  `drawer.component.ts:67`, the global `document` uses in
  `dialog-content.component.ts`).
- **State lives on the document**, under
  `Symbol.for('@gilav21/shadcn-angular/overlay-stack@1')`: the layer array, the
  saved body styles, and whether the Escape listener is installed. That is what
  makes UC-18 hold when the compiled packages bundle their own copy of this
  file. The `@1` is a protocol version — bump it if the stored shape changes.
- **One `keydown` listener per document**, bubble phase, installed on the first
  registration. On `Escape` it returns early when `event.defaultPrevented` or
  `event.isComposing`; otherwise it `preventDefault()`s, removes the top layer
  **synchronously**, and calls its `dismiss()`.
- **Components no longer handle Escape themselves.** Every Escape-closes branch
  listed in F-5/F-6 is deleted and replaced by a `bindOverlayLayer` call whose
  `dismiss` is what that branch used to do (including its focus restore). This
  is load-bearing: a popup that kept its own `preventDefault()`-ing Escape
  branch would make the dispatcher skip the event (UC-9) — it would still close
  itself, but by the old mechanism, and the next refactor would break it.
- **Components that consume Escape for an in-component purpose** keep doing so
  and must call `preventDefault()` (submenus already do; command page-back
  stops propagation, which also works).
- Scroll lock is **derived from the stack**: locked iff some registered layer
  has `modal: true`. First modal in: save `body.style.overflow` and
  `body.style.paddingRight` (inline values, possibly `''`), set
  `overflow: hidden` and, when the scrollbar width is > 0, an inline
  `padding-right` of (computed right padding + scrollbar width) px. Last
  modal out: write the saved inline values back.

Which component registers what:

| Component | Layer | `dismiss` |
|---|---|---|
| `DialogComponent`, `SheetComponent`, `DrawerComponent`, `AlertDialogComponent` | modal | `hide()` (focus restore stays in the content components) |
| `PopoverComponent` | non-modal | `hide()` (existing `restoreFocus` path) |
| `SelectComponent` (both modes) | non-modal | `close()` + focus the trigger |
| `DropdownMenuComponent` | non-modal | `hide()` + `focusTrigger()` |
| `MenubarContentComponent` (while `menu.isOpen()`) | non-modal | `menu.close()` + focus its trigger |
| `ContextMenuComponent` | non-modal | `close()` |
| `SplitButtonComponent` | non-modal | close + focus the toggle |
| `EmojiPickerComponent` | non-modal | `hide()` + focus the trigger |
| `EyedropperComponent` (fallback sampler only) | non-modal | the sampler's `onCancel` |
| `DatePickerComponent`, `DateRangePickerComponent` | non-modal | close + focus the trigger |

### 3.3 Efficiency

No meaningful performance concern. Registration is O(n) in open overlays (n is
single digits). One document listener replaces up to one per mounted
select/popover/context-menu — today every mounted `ui-select` adds a document
`click` **and** `keydown` listener even while closed; the `keydown` ones go.
`tabbableElements` runs on Tab only, over the panel's subtree; budget: < 2ms
for a 200-control form in the browser leg (assert nothing — it is a guard
against an accidental `getComputedStyle` per element; prefer
`checkVisibility()`).

### 3.4 DX for the consuming developer

1. **What they must learn:** nothing for normal use. A consumer who writes their
   own Escape handling *inside* an overlay learns one rule, documented on
   `OverlayStackService` and in the dialog docs: "call `preventDefault()` when
   your component consumed Escape; the overlay underneath will then stay open."
2. **What they can ignore:** the stack, the lock, the focus helpers.
3. **Exported types they touch:** none new in templates. Library authors use
   `OverlayLayer`, `bindOverlayLayer`, `tabbableElements`, `trapTabKey`,
   `focusFirstTabbable`.
4. **e2e harness:** one new multi-component harness,
   `e2e/harness/overlay-stack/` with an `EXPLICIT_SPECS` entry in
   `e2e/orchestrator/specs.ts` (multi-component installs are the documented
   exception): `{ names: ['dialog', 'alert-dialog', 'select', 'date-picker'], label: 'overlay-stack' }`.
   Extend existing single-component harness specs only where T-16 does not
   reach.

### 3.5 Implementation options

#### 3.5.1 Escape

**Option 1 — Register every popup with the existing `hasOverlayAbove` protocol.**
Each popup pushes itself while open; each overlay keeps its own Escape listener
and returns early when something is above it.
Pros: smallest diff per component; the protocol already exists. Cons: correct
only by **timing** — when a popup closes on Escape, its unregistration runs in
an effect *after* the event has finished bubbling, so the modal underneath
still sees it "above" and stays open. Make the removal synchronous (an obvious
cleanup) and the modal closes too: the bug returns from a refactor. Still
needs one listener per overlay, and still fails when focus has fallen to
`<body>` (the modal's panel listener never fires).

**Option 2 — A `defaultPrevented` convention only.** Popups `preventDefault()`
(most already do); modals and popover ignore prevented Escapes.
Pros: tiny. Cons: depends on DOM order — works only when the popup's handler is
a DOM descendant of the modal's. Fails for document/window listeners
(context-menu, eyedropper, popover) that run *after* the modal's panel handler,
for portalled panels, and for focus on `<body>`.

**Option 3 — Central dispatcher in `OverlayStackService` + `defaultPrevented`
opt-out.** One document listener; the topmost registered layer is dismissed;
a prevented Escape is treated as consumed.
Pros: "exactly one" holds by construction, independent of DOM order, focus
location and effect timing; deletes ~12 bespoke Escape branches; fixes the
submenu and data-table-range cases as a side effect. Cons: touches every
overlay once; every popup must *stop* `preventDefault`-ing its own Escape
(enforced by T-8 and the mutation checks).

**✅ Chosen: Option 3**, because it is the only one whose correctness does not
depend on where focus is or when an effect flushes — the two things that
produced every finding in F-5.

#### 3.5.2 Scroll lock

**Option 1 — Ref-count in each component** (a module-level counter shared by
dialog/sheet/drawer). Pros: local. Cons: a fourth modal (alert-dialog) must
remember to join; duplicates the save/restore four times; a second bundled
copy (compiled packages) has its own counter.

**Option 2 — Derive the lock from the overlay stack** (`modal: true` layers).
Pros: one registry for Escape and scroll, so "open" means the same thing to
both; save/restore in one place; shared across copies via the document key.
Cons: the stack now owns a side effect on `<body>`.

**Option 3 — Native `<dialog>.showModal()`** (the platform locks interaction
and handles Escape via `cancel`). Pros: platform semantics. Cons: does **not**
lock scroll on its own; changes focus, top-layer and `::backdrop` behaviour of
four components — the same reason the drawer's `role="dialog"` exemption gives
(`docs/sonarqube-accepted-findings.md:69-73`). Ruled out.

**✅ Chosen: Option 2.**

#### 3.5.3 Focus trap

**Option 1 — Fix each component's selector.** Pros: minimal. Cons: four copies
of a non-trivial rule (disabled, fieldset, inert, hidden, radio groups,
negative tabindex) that already diverged once (dialog's first-focus excludes
`disabled`, its trap does not).

**Option 2 — Sentinel focus guards** (tabbable spans at the panel's edges that
bounce focus). Pros: catches any escape regardless of how tabbability is
computed. Cons: still needs first/last tabbable to bounce *to*; extra DOM in
four templates; axe flags focusable `aria-hidden` guards
(`aria-hidden-focus`).

**Option 3 — Shared helpers in `lib/a11y.ts`:** `tabbableElements(container)`,
`trapTabKey(event, container)` (wrap at the edges of the **tabbable** list;
if focus is outside the container, pull it to the first), and
`focusFirstTabbable(container)` (falls back to the panel). Pros: one rule, unit
testable (T-12); `lib/a11y.ts` already ships in both compiled packages, so no
new lib file. Cons: must degrade in jsdom (no `checkVisibility` → treat as
visible) so the shipped portable specs stay green.

**✅ Chosen: Option 3.**

### 3.6 Risks

| Risk | Mitigation |
|---|---|
| **R-1** A popup keeps its old `preventDefault()` Escape branch, so the dispatcher skips it and the popup "works" by the old path | T-8 asserts focus lands on the trigger (only the new `dismiss` does that for select/split-button); mutation check removes `bindOverlayLayer` per popup |
| **R-2** Shared state on the document leaks between tests in one file | TestBed teardown destroys fixtures → `bindOverlayLayer` unregisters on destroy. Unit tests unregister what they register. No test-only reset API |
| **R-3** Two bundled copies with **different** protocol versions on one page | The symbol key carries `@1`; a future shape change bumps it, so mismatched copies fall back to separate stacks (today's behaviour) instead of corrupting each other |
| **R-4** Headless Chromium hides scrollbars, so UC-5 geometry cannot be measured in the browser leg | Measure the runner's scrollbar width first; test compensation with a fake document (T-2). Record the measurement in the completion log |
| **R-5** jsdom has no `checkVisibility` — a layout-based filter would empty the ring in the portable leg | Feature-detect; absent → visible. T-12 asserts the fallback explicitly |
| **R-6** RTL page with a left scrollbar (Firefox, `dir="rtl"` on `<html>`) gets padding on the wrong side | Unchanged from today (out of scope). Noted in the service's JSDoc |
| **R-7** Removing the date-picker popup's blanket `stopPropagation` lets arrow keys reach enclosing handlers (a data-table cell editor, a dialog) | Stop propagation for every key **except** Escape; T-8's date-picker row plus the existing calendar keyboard specs must stay green |
| **R-8** `dropdown-menu-item` / `menubar-item` are edited by the sibling spec | Focus restore is implemented in `DropdownMenuComponent.hide()` and `MenubarContentComponent` — **not** in the item files (see §5.3) |
| **R-9** The data-table and RTE packages bundle their own copy of every touched file | Package users get nothing until a package release — see §5.2 |

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

**Additional gates for this spec** (on top of the five above):

- `npm run typecheck:templates` clean — the removed `hasOverlayAbove` API must
  have no template or code caller left.
- The **portable leg** for every touched component:
  `npm run verify:portable -- <name>` (never two runs at once). These components
  ship their specs to consumers.
- Run the **consumers** of shared code (CLAUDE.md "Fixing Bugs" §5):
  `npx shadcn-angular why dialog`, `… why popover`, `… why select`, and run the
  vitest folders of every reverse dependent — at least `command`, `kanban`,
  `tree-select`, `color-picker`, `autocomplete`, `data-table`,
  `rich-text-editor`, `shortcut-bindings-dialog`.
- e2e: `npm run e2e -- overlay-stack` plus the existing harnesses of every
  touched component (`dialog`, `dialog-focus`, `sheet`, `drawer`,
  `alert-dialog`, `select`, `dropdown-menu`, `menubar`, `context-menu`,
  `popover`, `date-picker`, `split-button`, `emoji-picker`, `eyedropper`), and
  `pkg-data-table` / `pkg-rte` / `pkg-mixed` once the packages are staged.
- After any JSDoc change: full `npm run docs:regen` (not just `docs:check`).
- `npm run check:registry -- --fix` after the last source task (new `lib/a11y.ts`
  imports change `libFiles`).

---

## 5. Release and coordination

### 5.1 CLI publish — **not required**

Only component source (`packages/components/ui/**`), lib source
(`packages/components/lib/**`), demo, stories, e2e harness and regenerated
registry data change. No CLI logic, no `ComponentDefinition` shape change, no
utils baselines — so it goes live from `master` on merge
(CLAUDE.md "When a CLI npm Publish Is Required").

### 5.2 Compiled packages — **both need a release**

Closures checked against `PACKAGE_ROOTS` in
`packages/cli/scripts/stage-package-lib.ts:31-39` and `registry.json`:

| Package | Touched files inside its closure | Verdict |
|---|---|---|
| `@gilav21/shadcn-angular-data-table` | `dialog`, `alert-dialog`, `select`, `date-picker` (both pickers), `context-menu`, `popover`, `lib/overlay-stack.service.ts`, `lib/a11y.ts` | `npm run release:package -- data-table <level>` after merge |
| `@gilav21/shadcn-angular-rte` | `dialog`, `alert-dialog`, `popover`, `emoji-picker`, `eyedropper`, `lib/overlay-stack.service.ts`, `lib/a11y.ts` | `npm run release:package -- rte <level>` after merge |

`sheet`, `drawer`, `dropdown-menu`, `menubar` and `split-button` are in neither
closure (CLI users only).

### 5.3 Conflict map against `keyboard-and-touch-activation-spec.md`

| This spec edits | Sibling edits | Overlap |
|---|---|---|
| `dropdown-menu/dropdown-menu.component.ts`, `…/sub/dropdown-menu-content.component.ts` | `…/sub/dropdown-menu-item.component.ts` | none (file-level) |
| `menubar/sub/menubar-content.component.ts` | `menubar/sub/menubar-item.component.ts` | none |
| `context-menu/context-menu.component.ts` | `context-menu/sub/context-menu-item.component.ts`, `…/context-menu-content.component.ts` | none |
| `lib/overlay-stack.service.ts`, `lib/a11y.ts` | `lib/touch.ts` | none |
| spec files `dropdown-menu.component.spec.ts`, `menubar.component.spec.ts`, `context-menu.component.spec.ts` | same | both append — keep both on merge |
| `registry.json`, `packages/cli/src/registry/index.ts` | same | regenerate, never hand-merge |

Date-picker work (F-6, F-7) lives **only** here.

### 5.4 Full list of source files this spec may touch

`lib/overlay-stack.service.ts`, `lib/a11y.ts`; `dialog/dialog.component.ts`,
`dialog/sub/dialog-content.component.ts(.html)`; `sheet/sheet.component.ts`,
`sheet/sub/sheet-content.component.ts`; `drawer/drawer.component.ts`,
`drawer/sub/drawer-content.component.ts(.html)`;
`alert-dialog/alert-dialog.component.ts`,
`alert-dialog/sub/alert-dialog-content.component.ts`;
`popover/popover.component.ts`; `select/select.component.ts`,
`select/sub/select-content.component.ts`;
`dropdown-menu/dropdown-menu.component.ts`,
`dropdown-menu/sub/dropdown-menu-content.component.ts`;
`menubar/sub/menubar-content.component.ts`;
`context-menu/context-menu.component.ts`;
`split-button/split-button.component.ts`;
`emoji-picker/emoji-picker.component.ts`;
`eyedropper/eyedropper.component.ts`;
`date-picker/date-picker.component.ts(.html)`,
`date-picker/sub/date-range-picker.component.ts(.html)`; their specs and
stories; `e2e/harness/overlay-stack/**`, `e2e/orchestrator/specs.ts`
(one `EXPLICIT_SPECS` entry); `docs/sonarqube-accepted-findings.md` only if a
genuine false positive appears.

---

## 6. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-15 and fix/delete the tests listed in §2.4. Observe each new test **fail** for the reason in §0 before any source change (record which row failed how) | all UCs | ⬜ Not started | — | — | — |
| 2 | `OverlayStackService` v2: `register`/`isTopmost`/`bindOverlayLayer`, document-keyed shared state, central Escape dispatcher (`defaultPrevented` + `isComposing` opt-outs), lock derived from modal layers with exact save/restore and scrollbar compensation via `DOCUMENT`. Migrate `dialog`, `sheet`, `drawer` (delete their own lock code and Escape branches, remove constructor `window` reads); add `alert-dialog` as a modal layer | UC-1…UC-6, UC-8, UC-10, UC-11, UC-18 · T-1…T-7 | ⬜ Not started | — | — | — |
| 3 | Register every popup as a non-modal layer and delete its own Escape-close code: `popover`, `select` (both modes; remove the document `keydown` listener), `dropdown-menu`, `menubar`, `context-menu`, `split-button`, `emoji-picker`, `eyedropper` (fallback sampler), `date-picker`, `date-range-picker` (popup stops propagation for every key except Escape) | UC-7, UC-9 · T-8, T-9 | ⬜ Not started | — | — | — |
| 4 | `lib/a11y.ts`: `tabbableElements`, `trapTabKey`, `focusFirstTabbable`; use them in `dialog-content`, `sheet-content`, `drawer-content`, `alert-dialog-content` (first focus + trap); replace global `document` with injected `DOCUMENT` there | UC-12, UC-13, UC-14 · T-10, T-11, T-12 | ⬜ Not started | — | — | — |
| 5 | Focus return for popups that held focus: data-driven `ui-select` commit/close, `DropdownMenuComponent.hide()` (restore only when focus was inside the panel), `MenubarContentComponent` close, `ui-split-button` close | UC-15 · T-13 | ⬜ Not started | — | — | — |
| 6 | `ui-select`: outside click closes (and touches) only when open | UC-16 · T-14 | ⬜ Not started | — | — | — |
| 7 | Date pickers: outside-click test uses **this** picker's own wrapper (`this.el.nativeElement.contains(target)`), for both pickers | UC-17 · T-15 | ⬜ Not started | — | — | — |
| 8 | e2e `overlay-stack` harness + `EXPLICIT_SPECS` entry (T-16); run every harness in §4; update JSDoc that describes the old behaviour (dialog/sheet/drawer/popover Escape docs, `split-button.component.ts:339-342`, select `close()`), stories that demo nesting, `docs:regen`, `check:registry -- --fix`; bundle-close Sonar gate; record package-release notes | UC-2, UC-7, UC-8, UC-12, UC-15 · T-16 | ⬜ Not started | — | — | — |

---

## 7. Completion log

*(Append one entry per task as it completes — never edit or delete an earlier
entry. Superseded decisions are marked superseded with a link to the entry that
replaced them.)*

### Task 1 — failing tests first

Tests that cannot pass before their task are run as expected failures
(`it.fails`): the `PENDING` label set in `dialog/overlay-nesting.browser.spec.ts`,
`PENDING_PAIRS` in `date-picker.component.browser.spec.ts`, and `it.fails`
directly in the service, a11y, select and date-picker coverage specs. Each task
drops the markers of the rows it fixes. Observed with every marker removed, at
14216e9b:

| Test | Row(s) | How it failed |
|---|---|---|
| T-1…T-6 | all | `register is not a function` — the v2 API does not exist |
| T-12 | both | `tabbableElements is not a function` |
| T-7 | sheet + created dialog, nested dialog, destroyed sheet, alert dialog alone | `overflow` `''`, expected `hidden` (F-1, F-2, F-4) |
| T-7 | drawer over consumer `overflow-y`; closed drawer + sheet created | consumer `overflow-y: scroll` / whole inline style erased (F-2) |
| T-8 | 11 of 13 rows | the modal panel is gone after one Escape (F-5) |
| T-8 | date-picker | Escape in the calendar did nothing; the popup stayed (F-6) |
| T-9 | dropdown submenu | the second Escape closed the root menu **and** the dialog |
| T-9 | context-menu submenu | the third Escape did not close the dialog: focus had fallen to `<body>` (UC-10) |
| T-10 | 6 edge rows | focus left the panel (F-8) |
| T-11 | 4 rows | focus stayed on the trigger / disabled button outside the panel (F-9) |
| T-13 | select, dropdown, menubar | focus on `<body>` (F-10) |
| T-13 | split-button | the dialog had already closed with the menu (F-5) |
| T-14 | both modes | `touched` true after a click elsewhere (F-11) |
| T-15 | single/single, range/range | picker A stayed open (F-7); the mixed pairs already pass |

Rows that already pass and run as plain tests: T-7 alert dialog in a sheet (the
alert dialog never touched the lock), T-8 popover in a sheet, T-10 all-enabled
dialog, T-11 dialog in dialog, T-15 mixed pairs.

Deviations from §2.3, deliberate:

- **T-7 row 4** is split: "alert dialog in a sheet, opened then closed" (passes
  today) and "alert dialog alone" (fails today — F-4, it never locks). The
  combined row could not show the alert dialog's own lock.
- **T-10 roving row** uses `ui-tabs` (active tab `tabindex="0"`, the others
  `-1`) instead of `ui-calendar`: the calendar's day buttons are `ui-button`s
  disabled outside the month, not a roving `tabindex` — there is no roving
  control in it to sample.
- **T-10** asserts that every tab stop is visited, not only that focus stays
  inside, so a trap that swallows Tab without moving focus fails.
- **T-9** focuses the submenu's first entry by hand after opening it: moving
  focus into a context submenu is the sibling keyboard spec's work.
- **T-2's runner scrollbar measurement** is recorded with Task 2, where the
  service first measures it on the real document. T-2's body has inline
  `padding-right: 1rem` against a computed `16px`, so adding the scrollbar to
  the inline string instead of the computed value fails it.
- **Shipped specs** (`select.component.spec.ts`, `date-picker.coverage.spec.ts`
  also run under jest, which has no `it.fails`) use a local
  `pendingUntilTask6/7` that is `it.fails` under vitest and `it.skip` under
  jest; the task that fixes the behaviour replaces it with `it`.
- **Body-style fixtures:** `overlay-nesting.browser.spec.ts` and the service
  spec's scroll-lock block restore the body's `style` attribute after each test
  because several rows *set* consumer inline styles as their input. This is
  restoring input, not hiding a lock leak — every lock row asserts the restored
  state itself before the hook runs.
- **Spec inconsistency for Task 2:** §3.2 says "save `body.style.overflow`".
  That shorthand reads `''` when only `overflow-y` is set, so restoring it
  would erase a consumer's `overflow-y: scroll` (UC-4, T-7 row 5). The save and
  restore must be per longhand: `overflow-x`, `overflow-y`, `padding-right`.

Removed per §2.4: the hand-built-event and all-enabled trap tests of dialog
(7 tests), sheet (4), drawer (5) and alert-dialog (4), each component left with
one jsdom-safe wiring test that sends a real `keydown` through the panel; every
`body.style.overflow/paddingRight = ''` reset (35 lines in 7 files); the three
`hasOverlayAbove` tests (rewritten as T-4…T-6); the two date-picker
"outside is a detached `div`" tests (now another picker of the same kind).
