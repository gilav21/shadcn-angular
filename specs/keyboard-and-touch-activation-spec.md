# Keyboard and Touch Activation Parity — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **Sibling spec:** `specs/overlay-stack-scroll-lock-and-escape-spec.md` (also no
> prerequisites). The two can run in parallel — they touch **disjoint source
> files** (conflict map in §5.3). **Escape** handling for every menu and popup
> (including date-picker Escape) and **focus return** for dropdown/menubar/
> select belong to the sibling; this spec never edits an Escape branch. Both
> append tests to `dropdown-menu.component.spec.ts`, `menubar.component.spec.ts`
> and `context-menu.component.spec.ts`, and both regenerate `registry.json`;
> on merge keep both sides of the spec files and **regenerate** the registry
> (`npm run check:registry -- --fix`), never hand-merge it.

---

## 0. Step 0 — findings verified against the source (2026-10-03)

Every finding below was re-read in the component **and** its spec file before
it was written into this spec. ✓ = confirmed as reported. ⚠️ = the report was
wrong or incomplete; *believed* vs. *true* is stated. Line numbers are against
`docs/codebase-review-fix-specs` @ `6fae7f7f`.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| K-1 | Dropdown item Enter/Space never runs the action | ✓ | `dropdown-menu/sub/dropdown-menu-item.component.ts:28-30` binds `(click)`, `(keydown.enter)`, `(keydown.space)` to `onClick()`, which only calls `menu.hide()` (`:70-74`). The consumer's `(click)` on the host and the data-driven `item.click` (`dropdown-menu.component.ts:120-126`, bound as `(click)` on the item) are native click listeners — a keydown never dispatches a click on a `role="menuitem"` div, so the action runs only for a pointer. The specs that "cover" Space (`dropdown-menu.component.spec.ts:793-822`) assert only that the menu closed — content-free, and the reason this survived. |
| K-2 | Dropdown JSDoc: consumer `(click)` "still fires while disabled" | ✓, refined | JSDoc at `dropdown-menu-item.component.ts:65-69`. Pointer clicks are blocked by `pointer-events-none` (`:53`), so a sighted mouse user cannot hit it. ⚠️ *But* the host carries `data-disabled` only — **no `aria-disabled`** (`:22-31`) — so assistive tech announces an enabled item, and an AT activation or programmatic `.click()` runs the consumer's action. Same in `context-menu-item.component.ts:37-45` (its own JSDoc admits it emits neither attribute nor a role). |
| K-3 | Same class in menubar, context menu, command, navigation-menu | ✓ / ⚠️ | **Menubar:** Enter emits `(selected)` (`menubar-item.component.ts:23-24,80-85`) but the consumer's `(click)` on `<ui-menubar-item>` does not run on Enter, and **Space is not handled at all**. **Context menu:** items have no role, no tabindex and no key handling (`context-menu-item.component.ts:20-26`); the panel has no `role="menu"` and no keydown (`context-menu-content.component.ts:24-38`). Because items lack `role="menuitem"`, the sub-menu ring that walks `[role="menuitem"]:not([data-disabled])` is empty. **Command:** ⚠️ not affected — the documented action API is `(selectItem)`, emitted on click, on Enter on the focused row and via `selectActive()` (`command-item.component.ts:31-32,70-71`); a consumer binding `(click)` is using it wrong, which the node-editor palette already learned (`form-controls-small-spec.md` "Shipped"). **Navigation-menu:** ⚠️ not affected — triggers are buttons with `(click)` (`navigation-menu-trigger.component.ts:23`), links are anchors. |
| K-4 | Tap-to-show tooltips close immediately | ✓ | `tooltip/sub/tooltip.directive.ts:94-110` and `tooltip/sub/tooltip-trigger.component.ts:95-111` add a `{ once: true }` `touchstart` listener on `document` **while the opening `touchstart` is still dispatching**. Per the DOM Standard each object on the event path clones its listener list only when the event reaches it, so a listener added to an ancestor mid-dispatch fires for the same event (the classic "click-outside closes what the click just opened" bug) — the tooltip is hidden in the same tick it was shown. The specs pass only because they dispatch **non-bubbling** events (`tooltip-trigger.component.spec.ts:68-73`; `tooltip.directive.spec.ts:302-311`, whose comment claims the browser skips the listener for the in-flight event — that claim is wrong and is what hid the bug). |
| K-5 | `ui-tooltip-trigger` swallows the wrapped control's action on touch | ⚠️ new | `tooltip-trigger.component.ts:65-69` calls `event.preventDefault()` on `touchstart`, which cancels the click the browser would dispatch — so a `<ui-button>` wrapped in a tooltip trigger (the shape every tooltip story uses, `tooltip.stories.ts:52-53,75-76,92-93`) **cannot be activated by touch at all**. A test asserts the bug: `tooltip-trigger.component.spec.ts:159-163` "shows on touchstart and preventDefaults". The directive does not do this (`tooltip.directive.spec.ts:342`). |
| K-6 | Check hover-card and popover tap paths for K-4 | ⚠️ not affected | `hover-card.component.ts:113-129` adds its outside listeners in the **capture** phase on `document` from a click handler — the document's capture phase for that click has already run, and the handler ignores targets inside the host. `ui-popover` adds its document listener in the constructor, not mid-dispatch (`popover.component.ts:89-91`). Hover-card's documented `preventDefault()` on touch (`hover-card-trigger.component.ts:50-63`) is a deliberate trade-off — out of scope, §1.4. |
| K-7 | Right-click-only context menus | ✓, list is longer | `ui/context-menu-attach.directive.ts:35-53`, `ui/data-table-context-menu.directive.ts:44-75`, `ui/table-context-menu.directive.ts:47-92`, `ui/tree-context-menu.directive.ts:38-70` (story: `tree-context-menu.stories.ts:79`). ⚠️ *Believed:* kanban already uses `onLongPress`. *True:* it does **not** — card, column header and board menus are right-click only, and their JSDoc says so (`kanban-card.component.ts:154`, `kanban-column.component.ts:220`, board `kanban.component.ts:686-692`). Worse: `kanban.component.ts:611-612` tells touch users to move cards "through the card context menu's 'Move to' submenu" — which no touch user on iOS can open. Already correct: `context-menu-trigger.component.ts:35-43`, `context-menu-trigger.directive.ts:48-57`, `bento-grid.component.ts:164`, `data-table.component.ts:1860-1872` (range selection), `data-table/addons/context-menu/context-menu.directive.ts:90-93`, `node-editor-context-menu.directive.ts:100-110`. |
| K-8 | Android fires `contextmenu` after a long-press too | ⚠️ new | Chrome on Android raises a native `contextmenu` for a held finger. `node-editor-context-menu.directive.ts:160-185` swallows it within `SAME_GESTURE_MS = 700` (`:16`); nothing else does. So the data-table addon emits `rowMenuOpen` **twice** per long-press on Android (host `(contextmenu)` at `context-menu.directive.ts:38-44` **and** `onLongPress` at `:90-93`), and adding a naïve `onLongPress` to the four directives would double-emit their outputs. The four directives *do* work on Android today via that native event — the gap is iOS, which never fires it. |
| K-9 | Data-table resize auto-fit is `(dblclick)`-only | ✓, plus one | `data-table.component.html:737`; `onResizeTouchStart` cancels the touchstart (`data-table.component.ts:6005-6011`), so no `dblclick` is ever synthesised on touch. ⚠️ Also: `onResizeEnd` (`:6082-6096`) emits `columnResize` on every press **even with zero movement**, so one double-click emits three `columnResize` events (two no-op presses + the auto-fit) — the "exactly once" half of the invariant fails for mouse already. |
| K-10 | Context-menu items have no keyboard navigation | ✓ — **in scope** (decision) | Documented in `context-menu-item.component.ts:37-45`. Decided **in scope** because the invariant is violated outright (a menu opened with the keyboard context-menu key is a dead end), and the fix reuses the ring the sub-menu already implements (`context-menu-sub-content.component.ts`) rather than designing new interaction. |
| K-11 | Date-picker outside click / Escape | moved | Both date-picker findings live in the sibling spec (F-6, F-7 there) so every date-picker edit is in one spec. |
| K-12 | Consumers forced into workarounds | ✓ evidence | The demo app hand-wires the missing touch path: `demo/src/app/demos/data-display/tree-context-menu-demo.component.ts:245-373` (its own `onLongPress`), `context-menu-attach-demo.component.ts:53`, `data-table-context-menu-demo.component.ts:37`, `table-context-menu-demo.component.ts:218` ("the directive has no long-press, so a visible trigger opens the same menu"). Once the directives handle long-press, the tree demo's fallback would open the menu **twice** — it must go in the same task. |

---

## 1. Product Manager section

### 1.1 Business logic

Every action a component offers is reachable three ways — mouse, keyboard,
touch — and all three run **the same handler, exactly once**:

- Menu items (dropdown, menubar, context menu) activate with Enter and Space
  exactly as with a click, and a disabled item activates by no route at all.
- A context menu is navigable with the keyboard once open.
- Every right-click menu also opens with a long-press, once, on every platform.
- Tooltips shown by a tap stay visible, and never steal the tap from the
  control they describe.
- The data-table's double-click auto-fit also answers a double-tap.

### 1.2 Why the customer wants this

The consuming developer writes `(click)` once and expects it to work for
everyone. Today:

- **Keyboard users can open a dropdown, arrow to "Delete", press Enter — and
  nothing happens** except the menu closing. The workaround is to bind
  `(keydown.enter)` *and* `(click)` on every item and de-duplicate them.
- **iPhone users cannot open any table, tree or kanban context menu**, so a
  kanban card cannot be moved at all on iOS (the documented touch path *is* the
  context menu). The library's own demo pages ship hand-written long-press
  fallbacks and visible "⋮" triggers to paper over it — the workaround every
  consumer has to copy.
- **A button wrapped in a tooltip trigger does nothing when tapped** on a
  phone, and every tap-shown tooltip vanishes in the same instant it appears.
- **Analytics and side effects run twice on Android** for long-press menus that
  do have touch support.

### 1.3 Use cases — definition of done

Keyboard

- **UC-1** Pressing Enter on a focused `ui-dropdown-menu-item` runs the action a
  click runs — the consumer's `(click)` in custom mode, the item's `click`
  callback in data-driven mode — exactly once, and closes the menu.
- **UC-2** Space on a focused dropdown, menubar or context-menu item does the
  same as Enter, and the page behind does not scroll.
- **UC-3** Enter or Space on a `ui-menubar-item` runs both the consumer's
  `(click)` and `(selected)`, each exactly once.
- **UC-4** A disabled item in a dropdown, menubar or context menu runs no action
  by any route — pointer, keyboard, assistive-technology activation or
  programmatic `.click()` — and is exposed as `aria-disabled="true"`.
- **UC-5** When a context menu opens (right-click, long-press or the keyboard
  context-menu key / Shift+F10 on a focused target), focus moves to its first
  enabled item; ArrowDown/ArrowUp move through enabled items and wrap,
  Home/End jump to the ends, and submenu triggers and submenu items take part.
- **UC-6** Closing a context menu by activating an item, clicking outside or
  pressing Tab returns focus to the element that had it before the menu opened.
  (Escape is the sibling spec's; it gets the same restore through the shared
  close path.)

Touch

- **UC-7** Tapping a `[uiTooltip]` host or a `ui-tooltip-trigger` on a touch
  device shows the tooltip, and it stays visible until the auto-dismiss timeout,
  a second tap on the same trigger, or a tap anywhere else.
- **UC-8** Tapping a control wrapped in `ui-tooltip-trigger` on a touch device
  runs that control's own action exactly once.
- **UC-9** A one-finger long-press (500ms, ≤10px travel) on a target of
  `uiContextMenuAttach`, `uiTableContextMenu`, `uiDataTableContextMenu` or
  `uiTreeContextMenu` opens the menu at the finger and emits the same payload a
  right-click on the same target emits.
- **UC-10** A long-press on a kanban card, a kanban column header and empty
  kanban board space opens the card, column and board menu respectively — the
  card menu's "Move to" is reachable on iOS.
- **UC-11** One context gesture opens one menu and emits each output exactly
  once — including on Android, where the browser also fires `contextmenu` after
  a long-press, and including for the `data-table/context-menu` addon. With
  nested targets, the innermost wins, for long-press as for right-click.
- **UC-12** A finger that moves more than 10px, or a second finger, never opens
  a context menu.
- **UC-13** Double-tapping a data-table column resize handle auto-fits that
  column exactly like a double-click; a resize drag is never counted as a tap.
- **UC-14** A press on a resize handle that does not move emits no
  `columnResize`, so a double-click or double-tap auto-fit emits exactly one.

The spec is done when, and only when, every UC above demonstrably passes.

### 1.4 Explicitly out of scope

- **Escape** in any menu or popup, date-picker Escape and outside-click, and
  focus return for dropdown/menubar/select/split-button — the sibling spec.
- `ui-hover-card`'s documented touch `preventDefault()`
  (`hover-card-trigger.component.ts:50-63`): its card is the natural place for
  the link it previews; changing it is a design decision, not a fix of this
  class.
- Making context-menu **targets** focusable (table rows, kanban cards). UC-5
  covers a target that is already focusable (tree items are); focusability of
  each target is that component's own concern.
- **Keyboard** column resize / auto-fit in the data-table (the handle is a
  `role="separator"` with no tabindex). A focusable splitter with
  `aria-valuenow` and arrow-key resizing is its own spec; this spec covers only
  the touch half of K-9 and the duplicate-emission bug.
- Long-press vs. **range selection** in `ui-data-table`
  (`data-table.component.ts:1860-1872`): see R-4 — the directive yields; a
  combined gesture is a follow-up.
- Migrating `ui-context-menu-trigger` (component and directive) and
  `node-editor-context-menu` to the new helper. The trigger's Android double
  `show()` is idempotent and emits nothing; node-editor already dedupes.
- Hybrid devices whose primary pointer is fine but that also have a touch
  screen (`isTouchDevice()` is false there, so tap-to-show never engages).
- The data-table cell double-tap (`onCellTouchEnd`, `data-table.component.ts:4282-4315`)
  duplicating `onDoubleTap`'s logic — works today; consolidation is cleanup.

---

## 2. QA section — write these tests FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.
> This is the mechanism that keeps implementation honest against the PM
> section.

Follow `.claude/CLAUDE.md` › "Writing Tests": one test per behaviour, table
rows for input classes, real-shaped inputs, assert outcomes (the action ran,
its count, the menu that is visible, the rendered width) — never "the menu
closed" as a stand-in for "the action ran".

### 2.1 Where each test lives — and why

Every component touched is **portable-verified**
(`packages/components/portable-tests.json`), so its non-browser `*.spec.ts`
ships to consumers and must pass in **jsdom** too. Touch input in unit tests is
built the way `lib/touch.spec.ts:9-26` does it (a plain `Event` carrying a
`touches` array), because not every engine exposes a `Touch` constructor.
Geometry (rendered column width) and focus after animation frames go in
`*.browser.spec.ts`. Real touch and real keys go in e2e.

### 2.2 Traceability

| Test ID | Test name | File | Proves | Type |
|---|---|---|---|---|
| T-1 | `Enter and Space run the item's action exactly once` | `dropdown-menu/dropdown-menu.component.spec.ts` | UC-1, UC-2 | component |
| T-2 | `Enter and Space run (click) and (selected) exactly once each` | `menubar/menubar.component.spec.ts` | UC-2, UC-3 | component |
| T-3a/b/c | `a disabled item runs nothing by any route and says so` | dropdown-menu / menubar / context-menu `*.component.spec.ts` | UC-4 | component |
| T-4 | `an open context menu is a keyboard menu` | `context-menu/context-menu.component.browser.spec.ts` | UC-2, UC-5 | component (browser) |
| T-5 | `closing a context menu hands focus back` | `context-menu/context-menu.component.browser.spec.ts` | UC-6 | component (browser) |
| T-6 | `a tap-shown tooltip survives the tap that showed it` | `tooltip/sub/tooltip.directive.spec.ts` | UC-7 | component |
| T-7 | `the trigger shows on tap and leaves the wrapped control's tap alone` | `tooltip/sub/tooltip-trigger.component.spec.ts` | UC-7, UC-8 | component |
| T-8 | `onContextGesture: one call per gesture, innermost wins, platform echo swallowed` | `lib/touch.spec.ts` | UC-9, UC-11, UC-12 | unit |
| T-9 | `dismissOnOutsideTouch ignores the touch that registered it` | `lib/touch.spec.ts` | UC-7 | unit |
| T-10a…d | `a long-press emits what a right-click emits` | `context-menu-attach` / `table-context-menu` / `data-table-context-menu` / `tree-context-menu` `.directive.spec.ts` | UC-9, UC-11 | component |
| T-11 | `long-press opens the card, column and board menus` | `kanban/kanban.component.spec.ts` | UC-10, UC-11 | component |
| T-12 | `a long-press opens the row menu once on Android` | `data-table/addons/context-menu/context-menu.directive.spec.ts` | UC-11 | component |
| T-13 | `double-tap on a resize handle auto-fits like double-click` | `data-table/data-table.component.browser.spec.ts` | UC-13 | component (browser) |
| T-14 | `a resize press that does not move emits no columnResize` | `data-table/data-table.component.spec.ts` | UC-14 | component |
| T-15 | e2e: dropdown Enter runs the action; tooltip tap on a wrapped button; tree long-press + Shift+F10; kanban long-press "Move to" | `e2e/harness/{dropdown-menu,tooltip,tree-context-menu,kanban}/*.spec.ts` | UC-1, UC-5, UC-7, UC-8, UC-9, UC-10, UC-11 | e2e |

Every UC appears at least once.

### 2.3 What each test samples — the input classes

- **T-1** — a real "Actions" menu: Edit, Duplicate, Delete (each with a
  counter). Rows: custom mode, Enter on "Duplicate"; custom mode, Space on
  "Delete" (assert the Space keydown was `defaultPrevented` — no page scroll);
  data-driven `[items]` with a `click` callback, Enter. Assert the counter is
  exactly **1** (catches a double fire from keydown + synthesised click) and the
  menu is closed.
- **T-2** — a File menu (New, Open, Save). Rows: Enter, Space. Assert `(click)`
  count 1 and `(selected)` count 1.
- **T-3** — per component, one disabled item with a counter. Routes:
  `element.click()` (stands in for an AT activation — it bypasses
  `pointer-events`), Enter, Space; data-driven `disabled: true` row for
  dropdown and context menu. Assert count 0 and `aria-disabled="true"`; an
  enabled sibling still reports no `aria-disabled`.
- **T-4** — a context menu: Cut, Copy, *Paste (disabled)*, a "Share ▸" submenu
  (Email, Link). Open via a `contextmenu` event on a **focusable** target; after
  positioning frames, `document.activeElement` is "Cut". ArrowDown ×3 → "Share"
  (Paste skipped), ArrowDown → "Cut" (wrap), End → "Share", Home → "Cut";
  ArrowRight on "Share" (ArrowLeft under `dir="rtl"`) → focus in the submenu,
  ArrowDown walks Email → Link. Space on "Copy" → its action count 1 (UC-2).
  Items carry `role="menuitem"`, the panel `role="menu"`.
- **T-5** — rows: activate "Copy" with Enter; click outside; press Tab. Each
  time focus returns to the target that had it before opening — and when the
  user has meanwhile focused something else (clicked an input outside), that
  focus is left alone.
- **T-6** — fix the helper first: dispatch a **bubbling** `touchstart` from the
  host (the shape a real finger produces). Rows with `isTouchDevice()` forced
  true (existing `setTouchDevice` helper): tap host → tooltip present **after
  the dispatch completes**; tap elsewhere (`document.body`) → removed; tap host
  twice → removed and **not** re-shown by the same tap; timeout → removed.
- **T-7** — host is `<ui-tooltip-trigger><ui-button (click)="n = n + 1">Save</ui-button></ui-tooltip-trigger>`.
  Same rows as T-6, plus: the `touchstart` is **not** `defaultPrevented`
  (replaces the test that asserted it was), and a full tap sequence
  (`touchstart` → `touchend` → `click`, as the browser dispatches it) leaves
  `n === 1`.
- **T-8** — rows, each a separate expectation in one table-driven test:
  right-click → one call with `clientX/Y`, `target`, `source` a MouseEvent;
  handler returns `true` → native event `defaultPrevented`, `false` → not;
  long-press 500ms → one call at the finger, `source` the `touchstart`;
  long-press then a native `contextmenu` 100ms later (Android) → still one call,
  native event `defaultPrevented`; a right-click 1s after a long-press → a
  second call (a later right-click is honoured); finger travels 15px → no call;
  second finger joins → no call; a pan that travelled, then a native
  `contextmenu` (Android's own long-press mid-pan) → no call and prevented;
  **nested** elements both registered: innermost returns `true` → outer not
  called, for right-click **and** long-press; innermost returns `false` → outer
  called. Keyboard-initiated `contextmenu`: see R-2 — measure first, then add
  the row.
- **T-9** — register from inside a bubbling `touchstart` listener on the host:
  the callback is **not** called for that event; a later `touchstart` on
  `document.body` calls it once; a later one inside the host does not; the
  cleanup removes the listener.
- **T-10** — per directive, a realistic fixture: an invoices table with
  `data-row` JSON and `td[data-column]` cells; a three-level file tree; a data
  table with five rows; a card list for `uiContextMenuAttach`. Rows: right-click
  on a cell; long-press on the same cell. Assert the emitted payloads are equal
  apart from `event`, `menu.open()` is true and `menu.position()` is the finger
  point for the long-press; `contextMenuDisabled` → nothing for either. For
  `uiDataTableContextMenu`, one extra row with `enableCellRangeSelection` on →
  long-press emits nothing (R-4).
- **T-11** — a three-column board with cards. Rows: long-press a card → card
  menu open containing "Move to"; long-press a column header → column menu;
  long-press empty board space → board menu ("Add column"); long-press a card
  → the **board** menu is not also opened (innermost wins). Replace the tests
  that call `onContextMenu(...)` directly (`kanban.component.spec.ts:810-813`)
  with real dispatched events.
- **T-12** — long-press on a row followed 100ms later by a native
  `contextmenu` on the same cell → `rowMenuOpen` emitted once.
- **T-13** — a table with a long-text column. Measure the auto-fit width by
  double-clicking the handle in one fixture; in a second, identical fixture,
  double-tap it (two touchstart/touchend pairs, 100ms apart, same point) and
  assert the **rendered** column width (`getBoundingClientRect().width` of the
  header cell) equals the double-click result. Rows that must **not** fit: two
  taps 500ms apart; tap, drag 40px, tap. Geometry is asserted in the browser
  leg only.
- **T-14** — rows: mousedown + mouseup with no movement; touchstart + touchend
  with no movement → zero `columnResize`; a real drag of 30px → exactly one,
  with the new width; a double-click → exactly one (the auto-fit's).
- **T-15** — e2e against real consumer installs:
  - `dropdown-menu`: focus trigger, Enter to open, ArrowDown, Enter → the
    demo's action counter shows 1.
  - `tooltip`: `test.use({ hasTouch: true })`; **first assert**
    `matchMedia('(pointer: coarse)').matches` in the page (if false, add
    `isMobile: true` — Chromium only — and record which was needed);
    `locator.tap()` on the wrapped button → tooltip visible 300ms later **and**
    the button's counter is 1.
  - `tree-context-menu`: hold a real touch for 600ms via a CDP session
    (`Input.dispatchTouchEvent` touchStart → wait → touchEnd) on a tree item →
    menu visible, the demo's emitted-event log has **one** entry (Chromium's
    touch emulation may raise its own `contextmenu` — that is exactly the
    Android case); focus a tree item, `Shift+F10` → menu open with its first
    item focused.
  - `kanban`: same CDP hold on a card → "Move to" visible; choose a column →
    the card moved.

### 2.4 Existing tests to fix or delete (do this in Task 1, same commit)

Per "Writing Tests › When a bug or regression gets past the tests" — these are
answer **1** (a test covered the behaviour with the wrong input or assertion),
so they are **fixed**, not supplemented:

- `dropdown-menu.component.spec.ts:793-822` — assert the action ran (count 1),
  not only that the menu closed. They become T-1/T-3a.
- `tooltip-trigger.component.spec.ts:68-73` (non-bubbling helper) and
  `:159-163` (asserts the `preventDefault` that is K-5) — make the helper
  bubble, invert the assertion. They become T-7.
- `tooltip.directive.spec.ts:302-311` — make the helper bubble and delete the
  incorrect comment. It becomes T-6.
- `kanban.component.spec.ts:810-813` — dispatch real events (T-11).
- Delete any directive test made redundant by T-10's right-click row.

### 2.5 Edge cases the tests must cover

Disabled — T-3. RTL — T-4 submenu row under `dir="rtl"`. Touch-only — T-6…T-13,
T-15. Multi-touch — T-8. Nested targets — T-8, T-11. Empty — a context menu whose
items are all disabled: opening focuses the panel, arrows do nothing (T-4 row).
Single item — dropdown with one item, Enter runs it (T-1 row).

### 2.6 Coverage expectation

No uncovered lines in the new `lib/touch.ts` exports. Every other touched file
keeps or raises its line and branch coverage.

### 2.7 Mutation checks (before marking any task done)

Back up, break, run, restore — never commit a break. Each must turn a test red:
make Enter call `onClick()` instead of synthesising a click (T-1); synthesise
the click **and** keep calling the action (T-1 count 2); drop the disabled guard
(T-3); drop `aria-disabled` (T-3); register the tooltip dismiss listener in
the bubble phase (T-6, T-7, T-9); restore `preventDefault` in the trigger (T-7);
remove the Android-echo window in `onContextGesture` (T-8, T-12); remove the
claim set so the outer handler also runs (T-8, T-11); drop the travel check
(T-8); remove the zero-movement guard in `onResizeEnd` (T-14); remove one
directive's `onContextGesture` registration (T-10); keep the tree demo's own
long-press fallback (T-15 tree log shows 2).

---

## 3. Architecture

### 3.1 The invariant — the rule this spec implements

*Every action reachable by mouse is reachable by keyboard and by touch, and
activating it by any of the three runs the same handler exactly once.*

Sub-rules, each the one-sentence invariant of its task:

- **Menu items:** *a key activation is a click* — Enter/Space dispatch one native
  click on the item, so every listener a click reaches runs, once.
- **Disabled:** *a disabled item stops the click before any consumer listener
  sees it*, and says `aria-disabled="true"`.
- **Context gestures:** *right-click, keyboard context key and long-press are one
  gesture with one handler call*; a platform echo of the same gesture is
  swallowed, and the innermost target claims it.
- **Tap-to-show:** *the touch that opens a transient UI is never the touch that
  dismisses it.*
- **Resize:** *only a press that changed the width reports a resize.*

### 3.2 Usability — the API

Templates do not change. A consumer's existing `(click)` simply starts working
for keyboard and for disabled-safety:

```html
<!-- Custom mode: (click) now also runs on Enter/Space -->
<ui-dropdown-menu>
  <ui-dropdown-menu-trigger><ui-button variant="outline">Actions</ui-button></ui-dropdown-menu-trigger>
  <ui-dropdown-menu-content>
    <ui-dropdown-menu-item (click)="duplicate(row)">Duplicate</ui-dropdown-menu-item>
    <ui-dropdown-menu-item [disabled]="!canDelete()" (click)="remove(row)">Delete</ui-dropdown-menu-item>
  </ui-dropdown-menu-content>
</ui-dropdown-menu>

<!-- Simple (data-driven) mode: item.click now also runs on Enter/Space -->
<ui-dropdown-menu [items]="[{ label: 'Duplicate', click: () => duplicate(row) }]">
  <ui-dropdown-menu-trigger><ui-button>Actions</ui-button></ui-dropdown-menu-trigger>
</ui-dropdown-menu>

<!-- Context-menu directives: long-press now opens the same menu -->
<ui-tree [uiTreeContextMenu]="menu" (nodeContextMenu)="onNode($event)">…</ui-tree>
```

**One public type change** (pre-1.0 policy — required change, let `tsc` find the
call sites): the `event` field of `ContextMenuEvent<T>`,
`TableRowContextMenuEvent<T>` (and `TableCellContextMenuEvent<T>`, which extends
it), `DataTableHeaderContextMenuEvent` and `TreeContextMenuEvent<T>` widens from
`MouseEvent` to `MouseEvent | TouchEvent`. A long-press has no mouse event; the
originating `touchstart` is what is passed. Changelog entry required.

**New lib helpers** (`lib/touch.ts`), for component authors:

```ts
/** One context gesture, however it was made. */
export interface ContextGesture {
    readonly target: Element;
    readonly clientX: number;
    readonly clientY: number;
    /** The `contextmenu` event, or the long-press's `touchstart`. */
    readonly source: MouseEvent | TouchEvent;
}

/**
 * Calls `handler` once per context gesture on `element`: a right-click, the
 * keyboard context-menu key, or a one-finger long-press. Return `true` when you
 * acted on it — the gesture is then claimed: the native menu is suppressed,
 * ancestor `onContextGesture` handlers for the same gesture are skipped, and the
 * `contextmenu` a platform raises after a long-press (Android) is swallowed.
 * @returns cleanup
 */
export function onContextGesture(
    element: HTMLElement,
    handler: (gesture: ContextGesture) => boolean,
    duration?: number,
): () => void;

/**
 * Calls `onDismiss` on the next touch that starts outside `host`. Safe to call
 * from inside the touch that opened the UI: it never fires for that touch.
 * @returns cleanup
 */
export function dismissOnOutsideTouch(host: Element, onDismiss: () => void): () => void;
```

`onContextGesture` lifts the measured Android behaviour out of
`node-editor-context-menu.directive.ts:16,25,150-185` (700ms same-gesture
window, 10px slop, "a pan that travelled is not a press") into one place, and
builds on `onLongPress` rather than duplicating it.

### 3.3 Efficiency

No meaningful performance concern. `onContextGesture` adds four passive touch
listeners and one `contextmenu` listener per registered element — the same as
`onLongPress` plus the listener the directives already have. Kanban registers
per card: cards are already per-element components with their own listeners;
no budget change. The resize handle registers `onDoubleTap` per visible column
(single digits to low tens).

### 3.4 DX for the consuming developer

1. **Learn:** nothing for menus. For context-menu outputs, handle
   `event: MouseEvent | TouchEvent` (TypeScript will say so).
2. **Ignore:** the helpers, unless writing a component.
3. **Delete:** any hand-written long-press fallback for these directives — keeping
   it now opens the menu twice (the demo pages are fixed in this spec as the
   worked example).
4. **Error messages:** none new; the type widening is the only compile-time
   signal.

### 3.5 Implementation options

#### 3.5.1 Menu item activation

**Option 1 — Add an output (like menubar's `(selected)`) and emit it on click
and Enter/Space.** Pros: explicit. Cons: every existing consumer's `(click)`
stays keyboard-dead; the documented API of dropdown and context menu *is*
`(click)`, and data-driven items are wired through `(click)`.

**Option 2 — Enter/Space dispatch one native click on the item
(`host.click()`); the click is the single activation path.** Pros: the
consumer's `(click)`, data-driven `item.click` and the menu's own close all run
from one event, exactly once, with no API change. Cons: the disabled guard must
run **before** the consumer's listener on the same element — host-listener
ordering between a component and its parent template is not something to rely
on.

**✅ Chosen: Option 2.** The disabled guard is a **capture-phase** `click`
listener registered on the item's `parentElement` (an ancestor's capture phase
always precedes any listener on the target, in every engine — unlike at-target
capture ordering, which older jsdom does not implement): if the click's target is
inside a disabled item, `stopImmediatePropagation()` + `preventDefault()`.
Menubar is simpler — its menuitem is an inner `<div>` *inside* the host the
consumer binds on, so `event.stopPropagation()` in the div's handler keeps the
click from reaching the host.

#### 3.5.2 Long-press for right-click-only surfaces

**Option 1 — Add `onLongPress` beside each `contextmenu` listener** (the
data-table addon's pattern). Pros: copies existing code. Cons: double emission
on Android (K-8) in five places, and nested targets both fire on long-press
(right-click is protected by `stopPropagation`, a timer is not).

**Option 2 — Synthesise a `contextmenu` MouseEvent at the finger and let the
existing listeners run.** Pros: no type change. Cons: an untrusted event every
other `contextmenu` listener on the path also receives (including consumers'
own), still needs the Android dedupe, and depends on dispatch-order subtleties.

**Option 3 — One helper, `onContextGesture`, that owns the whole gesture**
(right-click, keyboard key, long-press, Android echo, innermost-wins claim).
Pros: each rule in one place, unit-testable (T-8); surfaces just say "open my
menu here". Cons: the payload type widens (§3.2).

**✅ Chosen: Option 3.** Used by the four flat directives, kanban (card,
column header, board) and the data-table addon (fixing its Android double).

#### 3.5.3 Tooltip tap dismissal

**Option 1 — Defer registration with `setTimeout(0)`.** Pros: one line. Cons:
timer-based; a race window; fake-timer noise in every tooltip test.

**Option 2 — Remember the opening event and ignore it.** Cons: `once: true`
would consume the listener on the ignored event; brittle.

**Option 3 — Capture-phase listener on the document, ignoring touches inside
the host** (`dismissOnOutsideTouch`). The document's capture phase for the
opening touch has already run when the listener is added, so it cannot fire for
it — deterministic, the pattern `hover-card.component.ts:113-129` already uses.
The `contains` check keeps a second tap on the trigger for the toggle alone.

**✅ Chosen: Option 3**, shared by the directive and the trigger component, and
the trigger's `preventDefault()` is deleted.

#### 3.5.4 Double-tap on the resize handle

**Option 1 — An in-component `(touchend)` tracker** like `onCellTouchEnd`.
Cons: re-implements `onDoubleTap` (travel, finger count, radius) a second time
in the same file.

**Option 2 — A container-level `onDoubleTap` resolving the handle from the
target.** Cons: `onDoubleTap` calls `preventDefault()` on the second `touchend`
of **any** double tap in the container (`touch.ts:259-261`) — it would swallow
the second click of a double tap on a checkbox cell.

**Option 3 — `viewChildren` of the handle elements + an effect that attaches
`onDoubleTap` to each and cleans up on change/destroy.** Pros: the lib helper,
scoped to exactly the element that owns the gesture. Cons: a little lifecycle
code.

**✅ Chosen: Option 3**, plus the zero-movement guard in `onResizeEnd` (UC-14).

### 3.6 Risks

| Risk | Mitigation |
|---|---|
| **R-1** The capture guard on `parentElement` misses an item that is re-parented or whose parent changes | Items are static children of their content; register in `afterNextRender` and clean up on destroy. T-3 covers projected **and** data-driven (`ng-container` → the panel is the parent) |
| **R-2** What Chromium reports for a keyboard-initiated `contextmenu` (Shift+F10) — `clientX/Y` may be 0 | **Measure in Task 1** (log `clientX/Y`, `button`, and the event's constructor in the browser leg) before writing the T-8 keyboard row. If the point is 0/0 or outside the target, the helper uses the target's bounding-rect bottom-start corner. Record the measurement in the completion log |
| **R-3** Chromium touch emulation in Playwright may or may not raise a native `contextmenu` after a CDP hold | T-15 asserts the **count is 1** either way, which is the property that matters; the unit test T-8 covers the echo deterministically |
| **R-4** `uiDataTableContextMenu` long-press collides with the table's own long-press range selection (`data-table.component.ts:1860-1872`) | Decision: when `enableCellRangeSelection()` is true the directive's long-press returns `false` (unclaimed) and range selection keeps the gesture, as documented today. T-10 samples both. Recorded in §1.4 as a follow-up |
| **R-5** Kanban cards are `draggable`; Android Chrome may start an HTML5 drag on a long-press | `onContextGesture` cancels a pending long-press on `dragstart` (add to the helper, with a T-8 row). Verify on the e2e CDP hold |
| **R-6** Widening the payload `event` type breaks a consumer reading `event.clientX` | Intentional, pre-1.0 policy; changelog entry; the menu already opens at the right point, so most consumers never read it |
| **R-7** Removing the tooltip trigger's `preventDefault` lets the emulated `mouseenter` double up with the tap | `onMouseEnter` already returns early on touch devices (`tooltip-trigger.component.ts:41-42`); T-7 asserts one visible tooltip and one click |
| **R-8** `lib/touch.ts` ships in **both** compiled packages | Additive exports only; see §5.2 for the release verdict |

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

- `npm run typecheck:templates` clean — the widened payload types must have no
  broken caller in the demo, stories or other components.
- The **portable leg** for every touched component and directive
  (`npm run verify:portable -- <name>`, one at a time).
- Run the **consumers** of `lib/touch.ts` after changing it — today
  (`grep -rl "lib/touch'" packages/components/ui`): bento-grid, color-picker,
  comparison-slider, context-menu, data-table (+ context-menu addon),
  dropdown-menu, eyedropper, file-upload, hover-card, infinite-canvas node-editor
  addons, kanban, menubar, navigation-menu, rating, scroll-area, signature-pad,
  sortable, tooltip; `npx shadcn-angular why context-menu`
  and `… why tooltip` for the rest.
- e2e: `npm run e2e -- <name>` for `dropdown-menu`, `menubar`, `context-menu`,
  `tooltip`, `context-menu-attach`, `table-context-menu`, `tree-context-menu`,
  `data-table-ctx-directive`, `data-table-context-menu`, `kanban`, `data-table`,
  and `pkg-data-table` / `pkg-rte` once the packages are staged.
- **Look at it on a touch device or an emulated one** (CLAUDE.md "Working
  Strategy"): the tooltip and long-press fixes are behaviours a DOM assertion
  can fake; confirm visually in the demo with Chrome DevTools touch emulation.
- After JSDoc changes: full `npm run docs:regen`.
- `npm run check:registry -- --fix` after the last source task (the four flat
  directives gain `touch.ts` in `libFiles`).

---

## 5. Release and coordination

### 5.1 CLI publish — **not required**

Only component source, lib source, demo, stories, e2e harness specs and
regenerated registry data change. No CLI logic, no `ComponentDefinition` shape
change, no utils baselines — it goes live from `master` on merge. (The widened
TypeScript payload types are component source, not the manifest shape.)

### 5.2 Compiled packages — **both need a release**

Closures checked against `PACKAGE_ROOTS`
(`packages/cli/scripts/stage-package-lib.ts:31-39`) and `registry.json`:

| Package | Touched files inside its closure | Verdict |
|---|---|---|
| `@gilav21/shadcn-angular-data-table` | `data-table` (resize double-tap, `onResizeEnd`), `data-table/context-menu` addon, `context-menu` (item, content), `lib/touch.ts` | `npm run release:package -- data-table <level>` after merge |
| `@gilav21/shadcn-angular-rte` | `tooltip` (directive, trigger), `lib/touch.ts` | `npm run release:package -- rte <level>` after merge |

The four flat directives, `dropdown-menu`, `menubar` and `kanban` are in neither
closure (CLI users only). `ui/data-table-context-menu.directive.ts` is a separate
registry entry and **not** in the data-table package closure.

### 5.3 Conflict map against `overlay-stack-scroll-lock-and-escape-spec.md`

| This spec edits | Sibling edits | Overlap |
|---|---|---|
| `dropdown-menu/sub/dropdown-menu-item.component.ts` | `dropdown-menu.component.ts`, `…/dropdown-menu-content.component.ts` | none (file-level) |
| `menubar/sub/menubar-item.component.ts` | `menubar/sub/menubar-content.component.ts` | none |
| `context-menu/sub/context-menu-item.component.ts`, `…/context-menu-content.component.ts` | `context-menu/context-menu.component.ts` | none |
| `lib/touch.ts` | `lib/overlay-stack.service.ts`, `lib/a11y.ts` | none |
| spec files `dropdown-menu.component.spec.ts`, `menubar.component.spec.ts`, `context-menu.component.spec.ts` | same | both append — keep both on merge |
| `registry.json`, `packages/cli/src/registry/index.ts` | same | regenerate, never hand-merge |

Behavioural seam: UC-6 restores focus in `context-menu-content` on every close;
the sibling's Escape closes through `ContextMenuComponent.close()`, so Escape
inherits the restore without either spec editing the other's file.

### 5.4 Full list of source files this spec may touch

`lib/touch.ts`; `dropdown-menu/sub/dropdown-menu-item.component.ts`;
`menubar/sub/menubar-item.component.ts`;
`context-menu/sub/context-menu-item.component.ts`,
`context-menu/sub/context-menu-content.component.ts`;
`tooltip/sub/tooltip.directive.ts`, `tooltip/sub/tooltip-trigger.component.ts`;
`ui/context-menu-attach.directive.ts`, `ui/table-context-menu.directive.ts`,
`ui/data-table-context-menu.directive.ts`, `ui/tree-context-menu.directive.ts`;
`kanban/kanban.component.ts`, `kanban/sub/kanban-card.component.ts`,
`kanban/sub/kanban-column.component.ts`;
`data-table/data-table.component.ts(.html)`,
`data-table/addons/context-menu/context-menu.directive.ts`; their specs and
stories (`tree-context-menu.stories.ts:79` text); demo pages
`demo/src/app/demos/data-display/{tree-context-menu,context-menu-attach,data-table-context-menu,table-context-menu}-demo.component.ts`
(+ their `.locales.ts` copy); e2e harness specs listed in T-15.

---

## 6. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-14 and fix the tests listed in §2.4. Measure R-2 (keyboard `contextmenu` coordinates in Chromium) and record it. Observe every new test **fail** for the reason in §0 first | all UCs | ✅ Done | 2026-10-12 21:50 | 92 | Failing-first tests landed with markers that stay green; three review rounds (86, 88, 92) tightened potency and dropped a speculative fallback. Mutation checks were run per task, not once for the batch. |
| 2 | Menu item activation: dropdown and context-menu items — Enter/Space → one `host.click()`, Space `preventDefault`; disabled guard (capture on `parentElement`) + `aria-disabled`; context-menu items gain `role="menuitem"`, `tabindex="-1"`, `data-disabled`. Menubar item — Enter/Space → one inner-div click; disabled `stopPropagation`; `aria-disabled`. Fix the dropdown JSDoc that says `(click)` fires while disabled | UC-1…UC-4 · T-1, T-2, T-3a/b/c | ✅ Done | 2026-10-12 21:50 | 92 | The shared `lib/menu-activation.ts` kept three components to one rule; the first review (78) found shipped consumers (bento-grid, demos) with hand-wired key handlers that would now double-fire. |
| 3 | Context-menu keyboard: panel `role="menu"` + keydown ring (Arrow wrap skipping disabled, Home/End, Tab closes), focus first enabled item after positioning, restore prior focus on close (only if focus is in the panel or on `<body>`) | UC-5, UC-6 · T-4, T-5 | ✅ Done | 2026-10-12 21:50 | 92 | Ring, initial focus and focus return as specified; rows moved to the jsdom spec so the portable 100% floor holds, the browser spec keeps only RTL arrows and a real mouse click. |
| 4 | Tooltips: `dismissOnOutsideTouch` in `lib/touch.ts`; use it in the directive and the trigger; delete the trigger's `preventDefault`; update both JSDocs | UC-7, UC-8 · T-6, T-7, T-9 | ✅ Done | 2026-10-12 21:50 | 93 | One capture-phase helper replaces two copies of the same mid-dispatch bug; K-6 verified by reading hover-card and popover. |
| 5 | `onContextGesture` in `lib/touch.ts` (right-click, keyboard key, long-press, Android echo window, travelled-pan rejection, `dragstart` cancel, innermost claim). Migrate the four flat directives (widen payload `event` types) and the `data-table/context-menu` addon | UC-9, UC-11, UC-12 · T-8, T-10a…d, T-12 | ✅ Done | 2026-10-12 21:50 | 92 | The helper grew four rules the spec did not list (browser contextmenu beating our timer, `viaTouch`, untyped-event handling, two handlers on one element); each came from a review round and has a mutation-checked row. |
| 6 | Kanban: card, column header and board menus via `onContextGesture`; update the three "right-click only" JSDocs and the "Move to" note (`kanban.component.ts:611-612`) | UC-10, UC-11 · T-11 | ✅ Done | 2026-10-12 21:50 | 92 | viewChild + effect registration copes with the `@if`-switched board containers; reviewed together with the Task 5 follow-up. |
| 7 | Data-table: `onDoubleTap` on each resize handle (Option 3); `onResizeEnd` emits only when the width changed; update the handle's `aria-label` to "double-click or double-tap to auto-fit" | UC-13, UC-14 · T-13, T-14 | ✅ Done | 2026-10-12 21:50 | 92 | Handle-scoped `onDoubleTap`; the touchend that completes the double-tap must cancel the press's own resize or the auto-fit is reported twice. |
| 8 | Remove the demo workarounds (tree long-press fallback, "directive has no long-press" notes and visible fallback triggers that only exist for touch) and the story text at `tree-context-menu.stories.ts:79`; e2e T-15; run every harness in §4; `docs:regen`; `check:registry -- --fix`; changelog note for the payload type; bundle-close Sonar gate; record package-release notes | UC-1, UC-5, UC-7…UC-11 · T-15 | ✅ Done | 2026-10-12 21:50 | 92 | The e2e rows paid for themselves: they found the tree swallowing every key and the release click closing a long-press menu. Not run here: the Sonar gate (the coordinator runs it). |

---

## 7. Completion log

*(Append one entry per task as it completes — never edit or delete an earlier
entry. Superseded decisions are marked superseded with a link to the entry that
replaced them.)*

### Execution on `worktree-agent-a8929c9ab866d975d` (2026-10-12, one agent, independent reviewers per task)

Commits, in order: Task 1 `af29023a` `7049c870` `69511dc7`; Task 2 `9855d5a1` `6a5be13b` `766efc0c`; Task 3 `90ba1978` `c7811d32`; Task 4 `3924be1f`; Task 5 `b445ed18` `7310ff6a` `10b36d83` `0fb8eb86`; Task 6 `a523568d`; Task 7 `f31eb2a2`; Task 8 `5f15c9d5` `cb2242a5` `09ff739d` `6f1894da` `61308d9a`.

**Review scores (fresh reviewer each round; the last round is the recorded one).** Task 1: 86, 88, **92**. Task 2: 78, **92**, 92. Task 3: 84, **92**. Task 4: **93**. Tasks 5 and 6: 86 and 79, then **92** for both after the `viaTouch` follow-up. Task 7: **92**. Task 8: 87, **92**.

**R-2 measurement (Chromium, Playwright, Windows, vitest browser leg).** Shift+F10 and the ContextMenu key both raise a `PointerEvent` with `button: -1`, `detail: 0`, at the centre of the focused element (target rect x 200 y 150 w 120 h 40 gave `clientX 260, clientY 170`). A real point is reported, so no corner fallback exists; a speculative one added in Task 1 was removed after review. Tooltip e2e: `hasTouch: true` alone yields `(pointer: coarse)`, no `isMobile` needed. Chromium's CDP touch hold raises **no** native `contextmenu` (iOS-like) but **does** raise a `click` on release; the click closed the menu until `onContextGesture` learned to swallow it.

**Deviations from the spec, all deliberate.**
- **Disabled guard** is a capture-phase `click` listener on the item's **own host**, not on `parentElement`: capture listeners at the target run before bubble listeners in every current engine, and a dropdown item has no parent while the menu is closed. Shared in `lib/menu-activation.ts`; menubar guards its `display: contents` host.
- **`ContextGesture` gained `viaTouch`**, `touch.ts` gained `pointOf()`; `isTouchContextMenu` types a `contextmenu` by `pointerType` where the browser says, otherwise by a finger having touched the element within 700 ms.
- **Kanban / flat directives drop their public handlers** (`onContextMenu`, `onHeaderContextMenu`, `onBoardContextMenu`, the attach directive's `@HostListener`): registration is internal.
- **Tree** (not in the spec's file list) was fixed: it cancelled every keydown. It now cancels only keys it handles.
- **Demos**: the tree demo's fallback went in Task 5 (it would open the menu twice); the `⋮` buttons in the attach / table / data-table demos stay as discoverability aids with their "touch only" notes and locale keys removed. The bento-grid menu and three demo pages lost their `(keydown.enter)`/`(keydown.space)` duplicates (Task 2 follow-up).
- **Tests moved layer** to hold the portable 100%-lines floor: the context-menu ring and focus-return rows live in the jsdom spec; the browser spec keeps RTL arrows and a real mouse click.
- **T-7** wraps a native `<button>`, not `<ui-button>` (the portable closure of tooltip does not include button).
- **Not done:** the `npm run sonar:gate` scan (lead, per instruction); the `pkg-data-table` / `pkg-rte` e2e (needs the packages staged); kanban / dropdown / menubar real-device checks (only Chromium emulation).

**Gates run.** `typecheck`, `typecheck:templates`, `lint` (only a pre-existing `vitest.config.ts` warning), `check:registry` (in sync), `docs:regen`, `test:cli` (2011), portable verification for dropdown-menu, menubar, context-menu, tooltip, tree, kanban, bento-grid, context-menu-attach, table-context-menu, data-table-context-menu, tree-context-menu and data-table, and e2e for dropdown-menu, tooltip, tree-context-menu, kanban, menubar, context-menu, context-menu-attach, table-context-menu, data-table-ctx-directive, data-table-context-menu, bento-grid and data-table (the last runs its addon siblings too).

**Release consequences.** No CLI publish. `release:package data-table` **and** `release:package rte`: the data-table closure gained `lib/menu-activation.ts` (its staged file count went 182 to 183, asserted in two CLI specs) and changed `context-menu`, `data-table`, `lib/touch.ts`; the rte closure changed `tooltip`, `lib/touch.ts`.
