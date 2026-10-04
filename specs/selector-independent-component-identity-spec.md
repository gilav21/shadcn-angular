# Selector-Independent Component Identity

> **Status:** Spec — ready for an executing agent
> **Date:** 2026-10-03
> **Source:** codebase review, owner's note: *"the prefix issue is real AND it's
> hardcoded — if we change the selector tomorrow it will break."*
> **Verified against:** `6fae7f7f` (branch `docs/codebase-review-fix-specs`).
> This document is append-only history. Never delete a task row, a superseded
> decision or a fixed bug — mark it and add the new entry below.

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.

**Invariant (the rule every task below serves):**

> Renaming a component's selector, or installing with any `--prefix`, never
> changes runtime behaviour; any selector reference that cannot follow
> automatically fails a test.

**Publish verdict:** **CLI publish REQUIRED** — Task 4 changes
`packages/cli/src/utils/prefix.ts` (bundled CLI logic, see CLAUDE.md "When a CLI
npm Publish Is Required" §1). Component source (`ui/**`) goes live on merge.
**`@gilav21/shadcn-angular-rte`:** its closure changes (`addons/mentions/`,
`addons/actions/`), so `release-package` will report it pending — cut a
**patch** release (`npm run release:package -- rte patch`). Package users always
get `ui-` tags (no CLI prefix), so for them the change is behaviour-neutral; the
release only keeps the package in step with source.
**`@gilav21/shadcn-angular-data-table`:** closure untouched — no release.
Re-verify both verdicts with `release-cli` / `release-package` in Task 7; do not
assert them from this paragraph.

---

## 0. Step-0 verification — what the review believed vs. what is true

Every claim was checked against the source at `6fae7f7f`. Paths are relative to
`packages/components/ui/` unless stated.

| # | Review claim | What the source says | Consequence |
|---|---|---|---|
| V-1 | `rich-text-mention-popover.component.ts:103-108` closes on `!target.closest('ui-rich-text-mention-popover')`; under `--prefix acme` "every click inside the popover closes it". | ✅ The query is real and tag-bound. ⚠️ **The impact is narrower than "every click":** an option-row click still works — `onItemClick` → `itemSelect` → the directive's `onSelect` → `close()` → `popoverRef.destroy()` (`rich-text-editor/addons/mentions/rich-text-mentions.directive.ts:188-212, 291-297`) runs **synchronously inside the dispatch**, and `ngOnDestroy` removes the document listener (`component.ts:151-153`) before the event bubbles to `document`, so the listener is never invoked. Every **other** click inside the panel closes it: the empty-state message (`.html:11-18`), the `p-1` padding around rows (`.html:21`), the listbox border, the `ui-scroll-area` scrollbar. The listener is a bubble-phase `click` on `document`, added in `ngAfterViewInit` (`:147-149`). The popover is **not** portalled or top-layer: the directive appends the host to `host.overlayAnchor` (`directive.ts:269-276`) and the panel `<div>` is a child of the `display:contents` host (`component.ts:34-36`, `.html:1`) — so `ElementRef.nativeElement.contains(target)` covers the whole rendered panel. | Fix must not name the tag (§D.4 set A). |
| V-2 | That `closest` is "the ONLY runtime DOM query by component tag name in `packages/components`". | ✅ True for DOM-query calls (grep over non-spec `.ts` for `closest/querySelector/querySelectorAll/matches` with a `ui-` literal, and `tagName/localName/nodeName` comparisons: one hit). ⚠️ **But it is not the only runtime selector-string dependency.** Two more exist that are not DOM-query calls: **(a)** `rich-text-editor/addons/actions/rich-text-actions.directive.ts:452-470` injects a global stylesheet whose rules are `ui-rich-text-editor [data-action-click], …` and `ui-rich-text-editor img[data-action-click], …` — under `--prefix acme` the action markers lose their dotted underline and dashed image outline; **(b)** `chat/chat.component.ts:65` uses the Tailwind arbitrary variant `[&>ui-avatar]:order-last` — under `--prefix acme` a user-role message's avatar is no longer moved after the bubble. The CLI rewrites neither (V-4). | Both are in scope (UC-2, UC-3). |
| V-3 | `applyPrefixTransforms` does not rewrite `<ng-content select="ui-…">`; 9 sites. | ✅ Confirmed (`packages/cli/src/utils/prefix.ts:119-132`: `.ts` → `selector:` metadata + `<ui-`/`</ui-` tags; `.html` → tags; `.css` → element selectors). The 9 sites, verified: `card-accordion/sub/card-accordion-trigger.component.html:16`, `error-page/error-page.component.html:2` and `:23`, `kanban/sub/kanban-column.component.ts:45` (inline template), `page-header/page-header.component.html:4` (`ui-breadcrumb, nav[data-slot=breadcrumb], [slot=breadcrumb]`), `result/result.component.html:36`, `split-button/split-button.component.ts:72` and `:126` (inline template), `tree/sub/tree-item.component.html:39`. Under `--prefix acme` the consumer's `<acme-kanban-column-header>` matches no named slot and falls into the default `<ng-content />`. Angular never errors on a `select` that matches nothing, so a library-internal selector **rename** breaks these silently too. `packages/blocks/**` has no `select=`, no tag-bound query and no `[&…ui-…]` class. | UC-4, UC-5. |
| V-4 | "Check whether the transform misses OTHER selector-bearing places." | Checked each: `:host-context(ui-…)` — none (the only `:host-context` uses are `.dark` in `data-table/data-table.component.css:7-97`); `@Component({ host })` strings — none carry a `ui-` element token; `viewChild/contentChild('ui-…')` — none; `ngProjectAs` — none. **Real misses:** the two in V-2 (a stylesheet string in TS and a Tailwind arbitrary-variant class string). **Covered by the CLI but rename-fragile:** CSS element selectors in component `.css` — `calendar/calendar.component.css:7` (`ui-select-trigger`) and `tree-select/tree-select.component.css:6` (`ui-popover`) are rewritten by `rewriteCssSelectors` (`prefix.ts:82-87`) but would break silently on a selector rename. **Trap for the implementer:** TS inline `styles:` in `sortable/sortable.component.ts:259-268` contain `@keyframes ui-sortable-ghost-fade-in` / `.ui-sortable-ghost-fade` — class and keyframe names, not element selectors; a naive "apply the CSS rewrite to TS too" would mangle them. Console labels (`[ui-data-table]`, `[ui-slider]`, `[ui-tour]`), `localStorage` keys (`'ui-sidebar:collapsed'`, `'ui-command:'`, `'ui-color-picker:'`, `'ui-tour:'`) and the `ui-icon` CSS class (`icon/icon.component.ts:1295`) contain selector-shaped tokens but are not selector dependencies. | UC-2, UC-3, UC-5; the guard needs a reasoned allowlist (§F.5). |
| V-5 | (not in the review) | ⚠️ **NEW.** `neutralizePrefix` (`prefix.ts:102-112`), used by `canonicalize` (`packages/cli/src/core/baseline.ts:29-31`) for `LEGACY_BASELINES` (migrate) and `COMPONENT_BASELINES` (clean-reinstall, `core/clean-reinstall.ts:150-162`), neutralizes only `selector:` metadata and tags — **not** CSS element selectors, although the installer rewrites those. So a pristine `--prefix acme` copy of `calendar.component.css` already never matches a baseline (treated as user-edited → protected). Rewriting `select="…"` extends the same gap to the 7 files with select slots. Both baseline files are generated with prefix `'ui'` (`scripts/gen-legacy-baselines.mjs:40`, `scripts/gen-component-baselines.mjs:22`). | Decided in §D.4 set E (document, do not regenerate baselines here). |
| V-6 | (not in the review) | ⚠️ **NEW, out of scope.** `add --include-tests` with a custom prefix ships spec files through the same transform (`core/install.ts:61`, `core/fetch.ts:83-90`). 131 `closest/querySelector/querySelectorAll/matches/By.css` calls with a `ui-` literal in **62** spec files are not rewritten, so those shipped tests fail in a prefixed consumer project. No guard prevents `--include-tests` + `--prefix`. | Recorded as follow-up (§B.4). |
| V-7 | "Evaluate whether the e2e `--prefix` harness should gain a projection assertion." | The only rendered prefix harness is `prefix-button` (`e2e/orchestrator/specs.ts:317-324`, `e2e/harness/prefix-button/`) — it asserts the tag rename and a click. `e2e/cli-specs/prefix-multi-install.ts` asserts `selector:` metadata and `diff` up-to-date for button/dialog/popover. Nothing installs a component with a `select` slot under a prefix. Note `specs/rich-text-editor.ideas.md` entry 13: the e2e fixture generates almost no Tailwind utilities (`.gitignore` hides installed components from Tailwind's scanner) — so an e2e **cannot** assert class-driven geometry; projection is structural and can be asserted by DOM position. | UC-9 (§D.4 set F). |
| V-8 | (enabler) | Angular is `21.2.22`; `createComponent(Cmp, { hostElement, environmentInjector, directives })` exists (`node_modules/@angular/core/types/core.d.ts:9222-9263`). A unit test can therefore render a component under a **non-`ui-` host tag** — a faithful runtime simulation of a prefix or rename. | The prefix input class is sampled in unit tests, not only e2e. |
| V-9 | "eslint `no-restricted-syntax` … forbidding `closest/querySelector/matches` with a `ui-` literal." | No `no-restricted-syntax` rule exists in `eslint.config.mjs` today; the shipped-code prefix rules are `@angular-eslint/{component,directive}-selector` (`:145-158`). ESLint sees only `.ts`; the three misses in V-2/V-3 that matter most live in `.html` `select` attributes, a TS string stylesheet and a Tailwind class string. | Evaluated and rejected in §D.4 set D. |

**Why the existing tests let these through** (CLAUDE.md "When a bug gets past
the tests"):

- Popover: `rich-text-mention-popover.component.spec.ts:136-157` renders through
  `TestBed.createComponent`, whose host tag *is* the selector — every test
  sampled only the `ui-` tag class. "Emits the clicked item" (`:148`) never
  asserts that `closed` stayed silent, and no test clicks a non-option area
  inside the panel. → case 2: add the input classes (non-`ui-` host tag;
  inside-but-not-an-option target) to the existing outside-click behaviour.
- Actions stylesheet: `rich-text-actions.directive.spec.ts:529-544` asserts the
  `<style>` element exists and is ref-counted — shape, not content. Nothing
  asserts an action marker is actually styled. → case 3: one new behaviour test.
- Chat avatar order: no test asserts the avatar's rendered position. → case 3.
- `select` slots: `packages/cli/src/utils/prefix.spec.ts` covers selector
  metadata, tags and CSS; no `select` input. → case 2 (new inputs in the
  existing `.ts`/`.html` describe blocks).

---

## B. Product Manager section

### B.1 Business logic

A component's identity at runtime — which slot its children project into,
whether a click is "inside" it, which elements a stylesheet targets — must come
from the component itself (its element reference, its `data-slot` hook), never
from the literal text of its selector. Where the selector text is genuinely
needed (an `<ng-content select>` slot, a CSS element selector in a component
stylesheet), the CLI's `--prefix` rewrite must cover it, and a repo test must
prove every such reference names a selector that exists.

### B.2 Why the customer wants this

| Pain today | Workaround forced today |
|---|---|
| "We installed with `--prefix acme` because `ui-*` collides with another library. The `@mention` list closes when I click its scrollbar or the 'No users found' line." | None reasonable — edit the copied popover to query `acme-rich-text-mention-popover`, and re-apply the edit after every `update`. |
| "With `--prefix acme`, `<acme-kanban-column-header>` renders inside the column body instead of the header slot" (same for split-button, result, error-page, page-header, tree, card-accordion). | Hand-edit `select="ui-…"` in seven installed files; `diff`/`update` then report them as locally modified forever. |
| "Action links in the editor have no dotted underline in our prefixed app." / "User chat bubbles show the avatar on the wrong side." | Find the hard-coded `ui-rich-text-editor` / `[&>ui-avatar]` by reading the source. |
| (Maintainer) "If we rename a selector tomorrow, nothing tells us which `select` slot or stylesheet still names the old one." | Grep and hope. |

### B.3 Use cases = definition of done

- **UC-1** With the popover host tag `ui-rich-text-mention-popover` **or**
  `acme-rich-text-mention-popover`: a click on the empty-state message or on
  the listbox padding leaves the popover open (`closed` not emitted); a click
  outside the popover emits `closed` exactly once.
- **UC-2** With the editor host tag `ui-rich-text-editor` **or**
  `acme-rich-text-editor` and `uiRteActions` attached: a `span[data-action-click]`
  inside the editable renders with `border-bottom-style: dotted`, and an
  `img[data-action-click]` with `outline-style: dashed`.
- **UC-3** A `ui-chat-message` with `role="user"` and an avatar renders the
  avatar visually **after** the bubble (LTR: avatar's left edge ≥ bubble's right
  edge); `role="assistant"` keeps it before. The chat source contains no `ui-`
  element token in a class string.
- **UC-4** `applyPrefixTransforms(file, content, 'acme')` rewrites every
  element-type `ui-*` token inside an `<ng-content … select="…">` value, in
  `.html` files and in inline templates of `.ts` files; attribute (`[slot=…]`,
  `nav[data-slot=breadcrumb]`), class and `:not(…)` *contents other than element
  tokens* are untouched; the default prefix is byte-identical (existing test).
- **UC-5** If any `select="…"` token, CSS element selector, tag, or `selector:`
  metadata in shipped source (`packages/components/ui`, `packages/components/lib`,
  `packages/blocks`) names a `ui-*` selector that no component/directive
  declares, `npm run test:cli` fails and the message names `file:line` and the
  token.
- **UC-6** If shipped source contains a known selector token (`ui-X` where
  `ui-X` is a declared selector) anywhere other than a tag, a `select` value, a
  CSS element selector in a `.css` file, `selector:` metadata or a comment —
  e.g. a DOM query string, a stylesheet string, a Tailwind arbitrary variant —
  `npm run test:cli` fails unless the occurrence is in the guard's allowlist
  with a written reason.
- **UC-7** For every shipped file, after `applyPrefixTransforms(file, content,
  'acme')` no declared `ui-*` selector token remains in a tag, `select`, CSS
  element-selector or `selector:` position — i.e. every position the guard
  permits is a position the CLI rewrites.
- **UC-8** `packages/cli/README.md` "Custom component prefix" lists the
  positions `--prefix` rewrites (selector metadata, element tags,
  `<ng-content select>` slots, CSS element selectors), and states that
  `--include-tests` specs are not prefix-rewritten yet (V-6).
- **UC-9** `npm run e2e -- prefix-projection` installs `result` into the
  pristine fixture with `init --prefix acme` and passes: `<acme-result-detail>`
  is projected into the named slot (a child of `[data-slot="result"]`,
  positioned before `[data-slot="result-actions"]`, not inside it).

### B.4 Explicitly out of scope

- Making shipped spec files prefix-safe under `--include-tests` (V-6: 131 calls
  in 62 files). Follow-up: either switch those queries to `data-slot` or extend
  the transform for spec files — record in the follow-up list, do not start.
- Neutralizing CSS element selectors / `select` values in `neutralizePrefix`
  and regenerating `LEGACY_BASELINES` / `COMPONENT_BASELINES` (V-5, §D.4 set E-2).
- Replacing the two rewritten CSS element selectors (`calendar`, `tree-select`)
  with `data-slot` selectors — they are CLI-covered; the guard now catches a
  rename (UC-5).
- Changing `data-slot` values, selectors, or any public input/output.
- Any ESLint rule (§D.4 set D).
- The compiled npm packages' selectors (they always ship `ui-`).

---

## C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them
> pass. Mutation-check the change per CLAUDE.md "Writing Tests" step 6 — break
> the code the way a plausible mistake would (from the contract, never from the
> assertion), watch a test go red, restore.

### C.1 Traceability table

Files: `POP` = `rich-text-editor/addons/mentions/rich-text-mention-popover.component.spec.ts`
(extend); `ACT` = `rich-text-editor/addons/actions/rich-text-actions.directive.spec.ts`
(extend); `CHAT` = `chat/chat.component.browser.spec.ts` (extend);
`PFX` = `packages/cli/src/utils/prefix.spec.ts` (extend);
`GUARD` = `packages/cli/scripts/selector-references.spec.ts` (new);
`E2E` = `e2e/harness/prefix-projection/prefix-projection.spec.ts` (new).

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `a click inside the panel that is not an option never closes the popover, whatever its host tag` — host tags `ui-rich-text-mention-popover` and `acme-rich-text-mention-popover` (the latter via `createComponent(…, { hostElement })`); targets: the empty-state message (`items = []`) and the `.p-1` row wrapper (`items = USERS`) | UC-1 | unit (POP) |
| T-2 | `a click outside closes the popover once, whatever its host tag` — the existing `:136` test, parametrised over the same two host tags (case 2: add the input class to the existing test, do not add a sibling) | UC-1 | unit (POP) |
| T-3 | `action markers are styled inside the editable, whatever the editor's host tag` — `span[data-action-click]` → computed `border-bottom-style: dotted`; `img[data-action-click]` → `outline-style: dashed`; host tags `ui-rich-text-editor` and `acme-rich-text-editor`. Browser leg; skip under jsdom with the repo's `navigator.userAgent.includes('jsdom')` idiom (jsdom does not apply stylesheet selectors to `getComputedStyle` reliably) | UC-2 | layout (ACT) |
| T-4 | `a user message renders its avatar after the bubble; an assistant message before it` — rects in LTR; no class-string assertion | UC-3 | layout (CHAT, browser leg) |
| T-5 | `.html: rewrites element tokens inside <ng-content select>` — inputs: single (`select="ui-result-detail"`), the page-header list verbatim (`ui-breadcrumb, nav[data-slot=breadcrumb], [slot=breadcrumb]` → only the first token changes), single-quoted value, `:not(ui-x)` | UC-4 | unit (PFX) |
| T-6 | `.ts: rewrites select inside an inline template` — the `kanban-column.component.ts:45` and `split-button.component.ts:72` lines verbatim inside a backtick template; also asserts a `select` **outside** `<ng-content` (`<select select="ui-x">`) and the string `'ui-sidebar:collapsed'` are untouched | UC-4 | unit (PFX) |
| T-7 | scanner unit: `reports a select token that names no declared selector, with file:line` — fixture: a declared-selector set `{ui-result, ui-result-detail}` and `select="ui-result-details"` | UC-5 | unit (GUARD) |
| T-8 | scanner unit: `reports an undeclared CSS element selector in a .css file, ignoring class/keyframe/custom-property tokens` — `ui-select-triggr {` reported; `.ui-select-trigger`, `--ui-select-trigger-h`, `@keyframes ui-x-fade` not | UC-5 | unit (GUARD) |
| T-9 | scanner unit: `reports a declared selector token in a TS string that is not a selector position` — inputs: `closest('ui-result')`, a stylesheet string `'ui-result [x]{…}'`, a class string `'[&>ui-result]:order-last'`; NOT reported: the same token in a `//` or `/** */` comment, in `selector: 'ui-result'`, in an inline template tag `<ui-result>`, in an inline `select="ui-result"`, and in a longer token (`ui-result-foo`, `ui-result-${n}`) | UC-6 | unit (GUARD) |
| T-10 | scanner unit: `honours an allowlist entry only for its exact file and token, and fails on a stale allowlist entry` | UC-6 | unit (GUARD) |
| T-11 | `the shipped library has no stale selector reference` — real scan of `packages/components/{ui,lib}` + `packages/blocks`, zero findings | UC-5 | unit (GUARD, real repo) |
| T-12 | `the shipped library has no selector dependency outside rewritable positions` — real scan, zero non-allowlisted findings | UC-6 | unit (GUARD, real repo) |
| T-13 | `every rewritable position is rewritten by --prefix` — for every shipped file, run `applyPrefixTransforms(file, content, 'acme')`, re-scan, and assert no declared `ui-*` token remains in tag / select / css-element / selector-metadata positions | UC-7 | unit (GUARD, real repo) |
| T-14 | `prefix-projection: <acme-result-detail> lands in the named slot` | UC-9 | e2e (E2E) |
| T-15 | README "Custom component prefix" lists the four rewritten positions and the `--include-tests` caveat | UC-8 | gate evidence (reviewer reads it; recorded in the log) |

Every UC appears: UC-1 T-1, T-2; UC-2 T-3; UC-3 T-4; UC-4 T-5, T-6; UC-5 T-7,
T-8, T-11; UC-6 T-9, T-10, T-12; UC-7 T-13; UC-8 T-15; UC-9 T-14.

### C.2 Test types covered

- **Unit, browser leg** (`npm run test-visual`) and **portable leg**
  (`npm run test:portable`): POP (both legs), ACT/CHAT layout tests (browser
  leg asserts computed style / rects; portable leg skips them — so run the
  browser leg **before** dispatching a reviewer, memory: layout tests).
- **Unit, CLI leg** (`npm run test:cli`): PFX, GUARD.
- **E2E**: one new explicit spec (§F.6). Existing `prefix-button`,
  `rte-mentions`, `rte-actions`, `chat`, `result`, `kanban`, `split-button`,
  `page-header`, `error-page`, `tree`, `card-accordion` harnesses must stay
  green (`npm run e2e:impact -- --base origin/master` lists them).
- **Storybook**: no visual change; existing stories stay the guard.
- **Perf**: no runtime perf claim. GUARD scans ~1,137 files (measured count at
  `6fae7f7f`) — budget < 5 s for T-11…T-13 together on the dev box; record the
  number.

### C.3 Edge cases and failure modes the tests must cover

| Case | Covered by |
|---|---|
| Popover: click on an option row still selects and does not *also* emit `closed` (current behaviour, kept) | T-1 (extra assertion in the `USERS` case: click a row → `itemSelect` once, `closed` zero) |
| Popover: the panel's `display:contents` host has no box — containment must be DOM, not geometry | T-1 (`contains`, not rect hit-testing) |
| Popover: two popovers alive (two editors) — a click in popover A closes B, not A | T-2 (extra case) |
| Actions: two editors, one prefixed host — the shared ref-counted stylesheet styles both | T-3 (both tags rendered in one document before asserting) |
| Chat: RTL (`dir="rtl"`) user message — avatar visually left of the bubble | T-4 (extra case) |
| Prefix: `select` with no `ui-` token (`[slot=x]`) and empty `select=""` | T-5 |
| Prefix: multi-line `<ng-content` tag (attributes on separate lines) | T-6 |
| Prefix: a prefix that itself contains a hyphen (`acme-ui`) | T-5 |
| Guard: CRLF files (184 blobs are CRLF, memory) — line numbers still correct | T-7 (CRLF fixture) |
| Guard: a `.css` comment containing `ui-x {` | T-8 |
| Guard: an HTML comment `<!-- <ui-x> -->` | T-9 (HTML variant) |
| Guard: a new component folder whose selector is declared in a `sub/` file | T-11 (selector set is built from every `.ts`, including `sub/`) |

### C.4 Coverage expectation

- `packages/cli/scripts/selector-references.ts`: 100% lines (it is pure).
- Changed lines in `prefix.ts`, `rich-text-mention-popover.component.ts`,
  `rich-text-actions.directive.ts`, `chat.component.ts`: 100% of the introduced
  lines; files' overall line coverage must not drop (record before/after from
  `npm run coverage` in the Task 1 retrospective).

---

## D. Architecture section

### D.1 Usability — the public API shape

No component input, output, selector or `data-slot` changes. What consumers
observe:

```bash
npx @gilav21/shadcn-angular init --prefix acme
npx @gilav21/shadcn-angular add result kanban split-button
```

```html
<!-- now projects into the named slot, exactly like <ui-result-detail> does unprefixed -->
<acme-result status="success" title="Saved">
  <acme-result-detail>Order #1042</acme-result-detail>
  <acme-button>Done</acme-button>
</acme-result>
```

Installed `result.component.html` after the change:

```html
<ng-content select="acme-result-detail" />
```

Maintainer-facing surface — the guard's failure output (§F.5):

```text
selector-references: 2 finding(s)
  STALE  packages/components/ui/result/result.component.html:36  select token "ui-result-details" names no declared selector
  RUNTIME packages/components/ui/foo/foo.component.ts:88  "ui-result" in a string literal — use ElementRef / data-slot, or allowlist it with a reason
```

### D.2 Efficiency

- Popover: `Node.contains` is O(depth) per document click — cheaper than
  `closest` with a selector string. No change in listener count.
- Actions stylesheet / chat: selector specificity unchanged in kind
  (attribute instead of type selector); no runtime cost.
- CLI: one extra regex pass per `.ts`/`.html` file at install — negligible
  next to the network fetch.
- Guard: one read + scan per shipped file in the CLI leg (budget in §C.2).

### D.3 DX for the consuming developer

- Nothing new to learn; `--prefix` simply works for slot projection, the
  mention popover, action markers and chat avatars.
- The CLI README documents which positions are rewritten and the
  `--include-tests` caveat (UC-8).
- For library maintainers: the rule "never reference a component by its
  selector text at runtime; use `ElementRef`, a `data-slot` attribute, or a
  directive class" is enforced by T-12, and the failure message says what to
  use instead.

### D.4 Implementation options

**Option set A — mention popover containment (UC-1)**

**Option A-1 — `inject(ElementRef)` + `host.nativeElement.contains(target)`**
Pros: no string at all; the panel is a DOM descendant of the host (V-1);
works for any tag; one line. Cons: a target detached from the host *during*
dispatch would read as outside — verified not to happen: the only in-panel
handlers are option `mousedown`/`click`, and an option click destroys the
popover synchronously, removing the listener before the event reaches
`document`; if it were ever invoked, the detached target is still inside the
detached host subtree, so `contains` stays true.

**Option A-2 — `event.composedPath().includes(host)`**
Pros: immune to mid-dispatch detachment and shadow roots. Cons: no reachable
case needs it (A-1 cons), so no test could distinguish it from A-1 — a choice
no test can defend is exactly what the mutation check would flag.

**Option A-3 — `target.closest('[data-slot="…"]')`**
Cons: still a string query; the popover has no `data-slot` today (adding one is
fine, but it ties containment to an attribute any nested component could also
carry).

**Option A-4 — mark events in a host `(click)` listener and check the mark at `document`**
Cons: more state, ordering-dependent, nothing gained over A-1.

**✅ Chosen: A-1**, because it is the only option with zero string coupling and
the one real edge (detachment) is verified unreachable and harmless.

**Option set B — `<ng-content select>` under `--prefix` (UC-4)**

**Option B-1 — Extend `applyPrefixTransforms` with an anchored `select` rewrite** (`<ng-content … select="…">`, element-type tokens only, `.ts` and `.html`)
Pros: mirrors the existing anchored-position design (`prefix.ts:41-87`);
touches nothing else; testable on the 9 real sites. Cons: CLI publish; the
consumer API still depends on the selector text by nature (Angular's `select`
is compile-time text) — which is why the guard (set D) exists.

**Option B-2 — Token-based rewrite of every declared selector token** (selector list shipped in the manifest)
Pros: one rule covers every position, including shipped spec files (V-6).
Cons: changes the manifest **shape** (publish + `isValidRegistryShape`);
rewrites comments, storage keys (`'ui-sidebar:collapsed'` → changes persisted
keys between installs), log labels and the `ui-icon` class; `neutralizePrefix`
and both baseline generators must mirror it. Far larger blast radius for a
7-file problem.

**Option B-3 — Replace `select` slots with `@ContentChild(DirectiveClass)` + `ngTemplateOutlet`**
Pros: no selector text anywhere. Cons: changes 7 components' projection model
(content must become templates or be moved imperatively); breaks the
documented "project `<ui-x-header>`" API the dual-mode pattern relies on.

**✅ Chosen: B-1.** B-2 is recorded as the route for V-6 if that follow-up is
ever taken.

**Option set C — the two runtime string dependencies (UC-2, UC-3)**

**Option C-1 — Retarget them at the existing `data-slot` hooks**
`[data-slot="rich-text-editor"] [data-action-click]…` (the editable carries
`data-slot="rich-text-editor"`, `rich-text-editor.component.html:43`) and
`[&>[data-slot=avatar]]:order-last` (`ui-avatar` host binds
`data-slot="avatar"`, `avatar/avatar.component.ts:21-24`). Pros: prefix- and
rename-proof by construction; `data-slot` values are explicitly never
rewritten (`prefix.ts:10-11`). Cons: none material — the editable *is* where
action markers live.

**Option C-2 — Teach the CLI to rewrite selector tokens in TS string literals and class strings**
Cons: string literals are unbounded (the anchored design deliberately refuses
them, `prefix.ts:47-48`); still breaks on a rename.

**✅ Chosen: C-1.**

**Option set D — the guard that stops the class coming back (UC-5…UC-7)**

**Option D-1 — One repo scan test in the CLI leg** (`packages/cli/scripts/selector-references.ts` + `.spec.ts`)
Pros: sees every file type (`.ts` strings, `.html` attributes, `.css`) and
every position kind; checks renames (token must be declared) **and** prefix
coverage (T-13 runs the real transform); one allowlist with reasons. Cons: runs
in `test:cli`, not in the editor.

**Option D-2 — ESLint `no-restricted-syntax` on `closest/querySelector/matches` with a `ui-` literal**
Pros: in-editor feedback. Cons: `.ts` only — blind to `select` slots, `.css`,
stylesheet strings and Tailwind class strings (3 of the 4 real misses); needs
its own allowlist in `eslint.config.mjs`; would be a second mechanism for one
concern (memory: one mechanism per concern).

**Option D-3 — Both.** Cons: D-2's cons, twice the allowlists.

**✅ Chosen: D-1.** D-2 is rejected, not deferred: D-1 strictly contains it.

**Option set E — `neutralizePrefix` and the baselines (V-5)**

**Option E-1 — Leave `neutralizePrefix` as is; amend its JSDoc to state exactly which axes it neutralizes and that prefixed CSS / `select` copies are conservatively treated as edited**
Pros: no baseline regeneration, no change to migrate/clean-reinstall
semantics; the failure direction is "protect the file", never "delete a user
edit". Cons: a stale pristine prefixed file with a `select` slot is kept, not
auto-pruned (same as `.css` today).

**Option E-2 — Neutralize `select` positions (both `ui-` and `<prefix>-`, so pre-fix prefixed installs still match) and regenerate both baseline files from git history**
Pros: keeps the "neutralize exactly what the installer rewrites" comment true
for `select`. Cons: regenerating `LEGACY_BASELINES` + `COMPONENT_BASELINES`
(build `dist` first; large generated diffs); utils-baseline change (publish
trigger on its own); CSS still not covered because `canonicalize` has no
filename — a half-fix.

**✅ Chosen: E-1**, with E-2 + a filename-aware `canonicalize` recorded as the
follow-up.

**Option set F — e2e (UC-9)**

**Option F-1 — New explicit spec `prefix-projection` (`names: ['result']`, `initArgs: ['init','--yes','--prefix','acme']`) asserting projection by DOM position**
Pros: proves the consumer-visible outcome in a pristine install; independent
of the fixture's missing Tailwind utilities (V-7). Cons: +1 spec (~30 s).

**Option F-2 — Assert `select="acme-…"` in `e2e/cli-specs/prefix-multi-install.ts`**
Cons: re-asserts T-5/T-6 at a higher layer (CLAUDE.md: never repeat an
assertion at another layer); proves text, not projection.

**✅ Chosen: F-1.** `result` is the smallest component with a `select` slot
(`result/` + `button` dependency).

### D.5 Risks

| Risk | Mitigation |
|---|---|
| The `select` regex rewrites a token inside an attribute value (`[slot=ui-x]`) or a class (`.ui-x`) | Inner rewrite only matches a token preceded by start/`,`/whitespace/`(` and followed by end/`,`/whitespace/`[`/`.`/`:`/`)` (§F.3); T-5 covers each. |
| A Windows CRLF file shifts guard line numbers | Normalise `\r\n` → `\n` before scanning; T-7 uses a CRLF fixture. |
| T-12's allowlist grows into a dumping ground | Each entry needs `{ file, token, reason }`; T-10 fails on a **stale** entry (token no longer present), so the list can only shrink silently, never rot. |
| T-3 renders the editor via `createComponent` with `directives: [RichTextActionsDirective]` and the directive cannot be attached that way (e.g. a required input) | Try `directives` first (Angular 21 supports `DirectiveWithBindings`, `core.d.ts:9263`). If it cannot attach, keep the computed-style assertion on the default `ui-` tag and, for the `acme-` class, rely on T-12 (the stylesheet string may contain no declared selector token). Record which path was taken in §G. |
| `[&>[data-slot=avatar]]` not generated by Tailwind v4 in the browser leg | T-4 is a rendered-geometry test in the browser leg — it fails if the class is not generated. Run it before review. |
| Sonar flags the new scanner (S3776) | Table-driven position finders, one function per position kind, each < 15. |
| Moving/adding files orphans a Sonar `resourceKey` exclusion | No file moves; new file only. |
| e2e orphan servers / stale caches mimic failures (memory) | Follow `e2e/README.md` troubleshooting; prove any red spec on base before blaming the change. |

---

## E. Task table (ordered = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-13 (POP, ACT, CHAT, PFX, GUARD — create `selector-references.ts` with exported, unimplemented function signatures so the spec compiles and fails on assertions) and the e2e skeleton T-14 (§F.6). Record pre-change coverage of every touched file. Confirm each test is red for the intended reason. | all UC | ✅ Done (red-first) | 2026-10-04 10:38 | 92 | Every test is red for its stated reason (§G 6–9), including a real prefix simulation for chat via `overrideComponent`. Sonar was scan-only because red tests fail the coverage leg by design. Next time: write the order-insensitive assertions from the start. |
| 2 | Mention popover: replace the `closest` query with `ElementRef.contains` (§F.1); update the `closed` JSDoc (`:83-88`) to say "outside this popover". T-1, T-2 green in both legs. | UC-1 | ✅ Done | 2026-10-04 11:05 | 93 | A one-line `contains` fixed the prefix bug and the A/B sibling-popover bug together (§G 10). Both mutation checks were killed. Sonar was deferred to the integration run (§G 11). |
| 3 | Actions stylesheet + chat: retarget at `data-slot` (§F.2). T-3, T-4 green in the **browser** leg; `rte-actions` and `chat` e2e green. | UC-2, UC-3 | ✅ Done | 2026-10-04 20:28 | 92 | Two string edits onto existing `data-slot` hooks. T-3 now also pins the scope: dropping it turns the test red. The first rte-actions e2e attempt died on infrastructure (ng serve timeout); a clean rerun was green. Sonar deferred (§G 11). |
| 4 | CLI: `select` rewrite in `applyPrefixTransforms` (§F.3); JSDoc on `neutralizePrefix` per E-1 (§F.4); README section (UC-8). T-5, T-6 green; existing `prefix.spec.ts`, `baseline.spec.ts`, `clean-reinstall.spec.ts` green. | UC-4, UC-8 | ✅ Done | 2026-10-04 20:38 | 91 (rounds: 90, 90) | The anchored select rewrite is right on all 9 real sites. Reviewers found three regex-shape gaps (`data-select`, `#id`, mixed quotes); each is now pinned by a T-5 input (§G 12). Next time: probe neighbouring attribute and token classes before the first review. Sonar deferred (§G 11). |
| 5 | Guard: implement `selector-references.ts` (§F.5) and its allowlist; T-7…T-13 green on the real repo. | UC-5, UC-6, UC-7 | ⬜ Not started | — | — | — |
| 6 | e2e: `prefix-projection` explicit spec + harness (§F.6); `npm run e2e -- prefix-projection` green; `npm run e2e -- prefix-button` still green. | UC-9 | ⬜ Not started | — | — | — |
| 7 | Gates: `npm run lint`, `npm run typecheck`, `npm run test-visual` (zero failures, pre-existing included), `npm run test:portable`, `npm run test:cli`, `npm run e2e:impact -- --base origin/master` then every listed spec, `npm run check:registry`, `npm run sonar:gate` (four-point verification, CLAUDE.md §4); run `release-cli` and `release-package` verdicts and record them; add this PR to the pending-releases memory (CLI logic change). | all | ⬜ Not started | — | — | — |

## Definition of Done (per task)

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

## F. Implementation notes for the executing agent (normative)

Re-locate every cited line first (line numbers are as of `6fae7f7f`).

### F.1 Mention popover (Task 2)

`rich-text-editor/addons/mentions/rich-text-mention-popover.component.ts`:

```ts
private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

private readonly clickListener = (event: MouseEvent): void => {
  if (!(event.target instanceof Node) || !this.host.nativeElement.contains(event.target)) {
    this.closed.emit();
  }
};
```

`ElementRef` is already imported (`:10`). Keep the document bubble-phase
listener and its `ngAfterViewInit`/`ngOnDestroy` lifecycle unchanged. A
non-`Node` target (e.g. `window`-dispatched synthetic event) counts as outside —
same as today's `closest` throwing/returning null path. T-1's non-`ui-` host:

```ts
const hostElement = document.createElement('acme-rich-text-mention-popover');
document.body.appendChild(hostElement);
const ref = createComponent(RichTextMentionPopoverComponent, {
  hostElement, environmentInjector: TestBed.inject(EnvironmentInjector),
});
TestBed.inject(ApplicationRef).attachView(ref.hostView);
```

### F.2 Actions stylesheet + chat (Task 3)

- `rich-text-actions.directive.ts:463-467` — replace each `ui-rich-text-editor `
  prefix with `[data-slot="rich-text-editor"] `. Do not change the declarations,
  the `data-rte-actions-style` marker or the ref-counting.
- `chat/chat.component.ts:65` — `[&>ui-avatar]:order-last` →
  `[&>[data-slot=avatar]]:order-last`.

### F.3 CLI `select` rewrite (Task 4)

In `packages/cli/src/utils/prefix.ts`, add `rewriteContentSelects(content,
newPrefix)` and call it for both `.ts` and `.html` in `applyPrefixTransforms`
(after `rewriteTemplateTags`). Shape (validate against T-5/T-6, adjust only if
a test proves a gap):

```ts
/** `<ng-content … select="…">` — rewrite only element-type `ui-*` tokens. */
const NG_CONTENT_SELECT = /(<ng-content\b[^>]*?\bselect\s*=\s*)(["'])([^"']*)\2/g;
const SELECT_ELEMENT_TOKEN = /(^|[\s,(])ui-([a-z][a-z0-9-]*)(?=$|[\s,.[:)])/g;
```

`[^>]*?` spans newlines (no `s` flag needed — `[^>]` already matches `\n`).
JSDoc must say why `select` is anchored on `<ng-content` (same reasoning as
`rewriteSelectorMetadata`, `prefix.ts:47-48`). `prefix` is validated kebab-case,
so no escaping is needed in the replacement.

### F.4 `neutralizePrefix` JSDoc (Task 4)

Amend `prefix.ts:93-101`: state that it neutralizes `selector:` metadata and
tags only; that the installer also rewrites CSS element selectors and
`<ng-content select>` values, which are **not** neutralized, so a prefixed
pristine copy of such a file canonicalizes differently from its baseline and is
conservatively treated as edited (kept, never pruned). Reference this spec.
Do **not** change its behaviour (E-1).

### F.5 The guard (Task 5)

`packages/cli/scripts/selector-references.ts` (pure, no IO in the core
functions; a thin `scanRepo(root)` does the IO) exports:

```ts
export type PositionKind = 'selector-metadata' | 'tag' | 'select' | 'css-element' | 'other-string';
export interface SelectorReference { file: string; line: number; token: string; kind: PositionKind; }
export function declaredSelectors(files: ReadonlyMap<string, string>): ReadonlySet<string>;
export function findSelectorReferences(file: string, content: string, declared: ReadonlySet<string>): SelectorReference[];
export interface AllowEntry { file: string; token: string; reason: string; }
export function checkReferences(refs: SelectorReference[], declared: ReadonlySet<string>, allow: readonly AllowEntry[]): string[]; // finding lines; [] = clean
```

Rules:

1. **Scope:** non-test `.ts`/`.html`/`.css` under `packages/components/ui`,
   `packages/components/lib`, `packages/blocks` (exclude `*.spec.ts`,
   `*.stories.ts`, `*-fixtures.ts`, `*.fixtures.ts`, `*.workload.spec.ts`).
   Normalise CRLF first.
2. **Declared selectors:** every element-type `ui-*` token in every
   `selector: '…'` value (components **and** directives — e.g.
   `ui-file-viewer-toolbar`), split on commas.
3. **Positions:**
   - `.ts`: tokenize with the TypeScript scanner (`ts.createScanner`, skipping
     trivia so comments never count). For each string / template literal:
     if the preceding significant tokens are `selector` `:` → `selector-metadata`;
     otherwise run the HTML finder on its text (inline templates), and any
     remaining whole token → `other-string`.
   - `.html` (and inline template text): strip `<!-- … -->`; `<ui-x`/`</ui-x`
     → `tag`; tokens inside `<ng-content … select="…">` → `select`; any other
     whole token in an attribute value or text → `other-string`.
   - `.css`: strip `/* … */`; element-selector tokens (same lookarounds as
     `rewriteCssSelectors`) → `css-element`; class (`.ui-x`), custom property
     (`--ui-x`), `@keyframes` names are not tokens.
   - A **whole token** is `ui-[a-z0-9]+(-[a-z0-9]+)*` not preceded by
     `[\w-]` and not followed by `[\w-]` or `${`.
4. **Findings:** `STALE` — a `tag`/`select`/`css-element`/`selector-metadata`
   token not in the declared set (rename guard). `RUNTIME` — an `other-string`
   token that **is** in the declared set and not allowlisted. `ALLOW-STALE` — an
   allowlist entry matching nothing.
5. **Allowlist** (`SELECTOR_REFERENCE_ALLOWLIST` in the same file): seed it
   with exactly what the first real run reports that is **not** a selector
   dependency, each with a reason. Expected seed, from Step 0 (verify, do not
   trust): `localStorage` key prefixes in `color-picker/color-picker.utils.ts`,
   `command/command.utils.ts`, `tour/tour.utils.ts`, `sidebar/sidebar.service.ts`
   (reason: persisted key, not a selector — changing it would orphan users'
   stored state); console labels in `data-table/data-table.component.ts`,
   `slider/slider.component.ts`, `tour/tour.component.ts` (reason: log label);
   the `ui-icon` class in `icon/icon.component.ts` (reason: CSS class name on
   the host, not an element selector). The mention popover, actions stylesheet
   and chat class must **not** be allowlisted — Tasks 2–3 remove them.
6. **T-13 (prefix coverage):** for each scoped file, `applyPrefixTransforms(f,
   content, 'acme')`, re-run `findSelectorReferences` against the declared set,
   and assert zero tokens of kind `tag`/`select`/`css-element`/`selector-metadata`.
   Import `applyPrefixTransforms` from `../src/utils/prefix.js` (the CLI leg
   already imports src from scripts specs).

The spec file reads the real repo with `fs` (precedent:
`packages/cli/scripts/docs-rte-guide.spec.ts`). Failure messages must print
every finding line (D.1 format) so a reader can act without re-running.

### F.6 e2e `prefix-projection` (Task 6)

- `e2e/orchestrator/specs.ts` `EXPLICIT_SPECS` (next to `prefix-button`,
  `:317-324`): `{ names: ['result'], label: 'prefix-projection', initArgs:
  ['init', '--yes', '--prefix', 'acme'] }` — an explicit entry is correct here
  because of `initArgs` (CLAUDE.md "E2E Authoring Workflow").
- `e2e/harness/prefix-projection/prefix-projection-demo.component.ts` imports
  `ResultComponent, ResultDetailComponent` from `@/components/ui/result` and
  renders `<acme-result status="success" title="Saved"><acme-result-detail
  data-testid="detail">Order #1042</acme-result-detail><button
  data-testid="action">Done</button></acme-result>`.
- `prefix-projection.spec.ts`: the detail element's `parentElement` is
  `[data-slot="result"]`; it is **not** inside `[data-slot="result-actions"]`;
  `compareDocumentPosition` puts it before the actions container; the plain
  `<button>` **is** inside `[data-slot="result-actions"]` (proves the default
  slot still works). No computed-style assertions (V-7).

### F.7 Consumers to run (CLAUDE.md "Run the consumers")

`npx vitest --run packages/components/ui/rich-text-editor packages/components/ui/rich-text-view packages/components/ui/chat`
plus `npm run test:cli`. `npx shadcn-angular why chat` / `why rich-text-editor`
list reverse dependents to include in e2e.

### F.8 Follow-ups to record (append to the review's follow-up list, do not start)

1. V-6: shipped spec files under `--include-tests` + `--prefix` (131 calls / 62
   files) — candidate fix: `data-slot` queries in specs, or Option B-2.
2. V-5 / E-2: filename-aware `canonicalize` that neutralizes CSS element
   selectors and `select` values, plus regenerated baselines.

---

## G. Corrections recorded by this spec (⚠️ — never rewrite silently)

1. ⚠️ "Every click inside the popover closes it" → option-row clicks still
   select (synchronous destroy removes the listener mid-dispatch); every other
   in-panel click closes it (V-1).
2. ⚠️ "The `closest` call is the only runtime dependency" → true for DOM-query
   calls; two more runtime selector-string dependencies exist: the actions
   stylesheet string and the chat Tailwind arbitrary variant (V-2).
3. ⚠️ NEW: `neutralizePrefix` already does not mirror the CSS rewrite; the
   `select` rewrite extends that gap — documented, not fixed (V-5, E-1).
4. ⚠️ NEW: `--include-tests` specs are not prefix-safe (V-6) — out of scope.
5. ⚠️ The suggested ESLint rule is rejected in favour of a single repo scan
   that sees all file types (D-1 vs D-2).

**Corrections found while executing this spec (append-only):**

6. ⚠️ (Task 1) "Chat avatar order: no test asserts the avatar's rendered
   position" (§0) is false — `chat.component.browser.spec.ts` already asserted
   the LTR user/assistant avatar position. T-4 therefore **extends** that test
   (case 2): RTL rows, plus a prefixed variant that renames `AvatarComponent`'s
   selector to `acme-avatar` and rewrites the chat template's tags via
   `TestBed.overrideComponent` — the runtime shape of a `--prefix acme`
   install. That variant is red before Task 3, so T-4 is a red-first test.
7. ⚠️ (Task 1) T-2's two-popover case is red **under the `ui-` tag too**: B's
   `closest('ui-rich-text-mention-popover')` matches A's host, so a click
   inside A never closes B. A pre-existing bug in the same class, fixed by A-1.
8. (Task 1) Guard contract pinned by the tests, beyond §F.5's wording:
   (a) `findSelectorReferences` returns `other-string` refs **only for declared
   tokens** (it takes `declared` for that reason); tag/select/css-element/
   selector-metadata refs are returned whatever the token, for the STALE check.
   (b) In `.css` the guard looks only at rule **preludes** (selectors) — a
   declaration value such as `animation: ui-x-fade 1s` is not a position,
   although `rewriteCssSelectors` would rewrite it. This is deliberately
   stricter than the CLI: T-13 needs guard positions ⊆ CLI positions, never
   the reverse. (c) Finding lines are column-aligned: `kind.padEnd(7) + ' '`
   (`STALE   …`, `RUNTIME …`), where §D.1 showed two spaces after STALE.
   (d) The order `findSelectorReferences` returns references in is not part of
   the contract; the tests compare them sorted. `checkReferences` does keep
   its input order (RUNTIME/STALE lines first, ALLOW-STALE last).
9. (Task 1) Pre-change line coverage (`npm run coverage` at 14216e9b sources):
   `chat.component.ts` 15/15 (100%); `rich-text-actions.directive.ts` 271/272
   (99.63%, line 339 uncovered); `rich-text-mention-popover.component.ts` 59/59
   (100%); `packages/cli/src/utils/prefix.ts` 22/25 (88%, lines 30, 31, 131).
10. (Task 2) §G 7 is fixed under the same invariant: "a popover's identity
    check never depends on the host tag name". `ElementRef.contains` makes
    each popover's inside its own subtree, so a click in popover A now
    closes B. Rendering was checked before choosing `contains` over
    `composedPath`: the directive appends the host to `overlayAnchor` (no
    top layer, portal or shadow root). Mutation checks: (a) the base
    `closest('ui-…')` turns T-1 (acme) and T-2 (both tags) red; (b) the
    plausible wrong fix `closest(host.localName)` turns T-2 red under both
    tags.
11. (process, 2026-10-04) On the human's instruction, relayed by the
    coordinator, per-task SonarQube runs were dropped from this worktree. One
    `sonar:gate` runs on the merged integration branch, and findings are
    routed back. DoD item 4 is therefore deferred to that run for Tasks 2–7.
12. (Task 4) §F.3's regex shape was adjusted, each change pinned by a T-5
    input: (a) the value is matched as `"…"` or `'…'` alternatives, not
    `(["'])([^"']*)\2`, so a value can contain the other quote; (b) `select`
    must not follow `[\w-]` (`(?<![\w-])select`), so `data-select="ui-x"` on
    an `<ng-content>` is left alone (`\bselect` matched it); (c) `#` joins
    the element-token lookahead, so `ui-x#id` is rewritten. (a) is pinned by
    `select="ui-x[data-kind='summary']"`. Mutations: going back to `\bselect`
    or to the backreference shape turns T-5 red. Known limit, no real site: a
    `>` inside an earlier attribute value on the same `<ng-content`
    (`[class]="a > b"`) ends the match before `select`; T-13 is the backstop
    for shipped sources.

---

## H. Completion Log

| Row | Date | Task | Reviewer score | Notes |
|---|---|---|---|---|
| 1 | 2026-10-04 10:38 | Failing tests T-1…T-14 | 92 (round 1: 89) | All red for the intended reason; reviewer confirmed that the CLI leg fails as reported and that §G 6–9 document the deviations. Sonar round 1: 14 open = master's accepted set, 0 in changed files. |
| 2 | 2026-10-04 11:05 | Popover containment via ElementRef.contains | 93 | Matches §F.1; `contains` is right for the overlayAnchor mount; the A/B case kills `closest(tag)`/`closest(localName)`/shared-attribute fixes. Portable 61/61; browser RTE+view 3275/3276 (T-3 = Task 3). |
| 3 | 2026-10-04 20:28 | Actions stylesheet + chat retargeted at data-slot | 92 | Matches §F.2 C-1; both anchors verified; browser RTE+view+chat 3298/3298; e2e chat ✓, rte-actions ✓ (rerun after ng-serve timeout). |
| 4 | 2026-10-04 20:38 | CLI `<ng-content select>` rewrite + neutralizePrefix JSDoc + README | 91 | All 9 V-3 sites correct; deviations pinned by T-5 inputs (§G 12); JSDoc accurate with behaviour unchanged (E-1); README lists four positions + `--include-tests` caveat (T-15). prefix/baseline/clean-reinstall 53/53. |
