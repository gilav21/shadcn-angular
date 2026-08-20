# Quality Gaps — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately.
>
> It touches `e2e/`, `packages/blocks/`, one orphaned stories file, and the
> registry's category metadata. No other Wave 0 bundle touches these.

**Status:** implemented — see §6
**Scope:** interactive e2e for the 10 blocks · `date-range-picker` orphan ·
directive discoverability · misplaced `rich-text-editor.ideas.md`
**Source plan:** `specs/ideas-backlog-2026-08-19.md` §4

---

## 1. Product Manager section

### 1.1 Business logic

Four hygiene items found during the library survey. None add features; all
reduce the chance of shipping something broken or undiscoverable.

### 1.2 Why the customer wants this

**The blocks gap is the serious one.** All 10 block components — `login`,
`signup`, `forgot-password`, `dashboard`, `settings-profile`,
`settings-account`, `pricing`, `hero`, `features`, `faq` — have **no
interactive e2e coverage**. Verified against `e2e/orchestrator/specs.ts` and
`e2e/harness/`: they are covered only by `add-all-smoke`, which installs every
component and runs a production build. That proves they *compile*. It does not
click anything.

So a broken submit button in the `login` block, a dead link in `pricing`, or an
accordion that never opens in `faq` would ship silently — and these are the
**first components a new user touches**. The blast radius is "first impression
of the library".

The other three are smaller:

- ~~**`date-range-picker` orphan**: a flat `date-range-picker.stories.ts` sits
  under `ui/` with no registry entry, no component folder, and no way to
  install it. It appears in Storybook, so a developer can find it, want it, and
  then discover `add date-range-picker` fails. That is worse than it not
  existing.~~
  > **❌ CORRECTED by Task 1 (2026-08-20).** This claim was wrong on all three
  > counts, and is kept here per the living-history convention rather than
  > deleted. Evidence:
  > `packages/components/ui/date-picker/sub/date-range-picker.component.{ts,html,css}`
  > all exist; `date-picker/index.ts` line 2 exports
  > `./sub/date-range-picker.component`; and the `date-picker` registry entry's
  > `files[]` already lists all three sub files (its description even reads
  > "Popover date **and date-range** picker"). So `add date-picker` installs it
  > today — nothing is uninstallable. The **only** real defect was the *stories
  > file* sitting flat under `ui/` instead of inside the `date-picker/` folder,
  > which violates the file-architecture convention in `.claude/CLAUDE.md`
  > ("`<name>.stories.ts` moves into the folder"). Resolution: **move**, not
  > delete. The root cause of the bad claim was searching the tree by *name*
  > (`date-range-picker*`) instead of by *capability* (the
  > `DateRangePickerComponent` class), which finds only the stories file.
- **Directive discoverability**: `input-mask`, `context-menu-attach`,
  `copy-to`, `tree-context-menu`, `table-context-menu`,
  `data-table-context-menu` are registered under `utility` / `form` categories
  alongside components. They are a different kind of thing — used as attributes,
  not elements — and a developer browsing by category will not find them.
  > **⚠ AMENDED by Task 7 (2026-08-20).** The count is wrong: there are **10**
  > directive-only registry entries, not 6. The list above misses `confetti`,
  > `ripple`, `magnetic` (category `animation`) and `component-outlet`
  > (category `utility`). Derived by filtering the registry for entries whose
  > `files[]` are all `.directive.ts`. The delivered work covers all 10, and the
  > T-14 test derives the set rather than hardcoding it, so directives added
  > later are held to the same convention automatically.
- **`rich-text-editor.ideas.md`** sits inside `packages/components/ui/`, a
  directory whose contents are shipped source. Planning notes do not belong there.

### 1.3 Use cases — definition of done

| ID | Use case |
|---|---|
| UC-1 | Each of the 10 blocks has an e2e spec that **interacts** with it — submits the form, opens the accordion, clicks the CTA — not merely renders it. |
| UC-2 | A deliberately broken block (e.g. a removed submit handler) causes its e2e spec to **fail** — proving the tests have teeth. |
| UC-3 | The block e2e specs are picked up by the impact analyzer, so a change to a block runs its spec in the impacted subset. |
| UC-4 | `date-range-picker` is either a fully registered, installable component **or** it is removed entirely — no orphan remains. |
| UC-5 | A developer can discover the six directives as directives — they are categorised distinctly from components. |
| UC-6 | `npx shadcn-angular list` (or equivalent) shows directives in a way that makes their nature obvious. |
| UC-7 | `rich-text-editor.ideas.md` no longer lives under `packages/components/ui/`. |
| UC-8 | The registry validator still passes and no installable component's `files[]` changed as a side effect. |

### 1.4 The `date-range-picker` decision

**This spec does not pre-decide it.** Task 1 is an investigation that reports
back: how complete is the stories file, does a usable component exist behind it,
and what would finishing it cost versus deleting it. **If the recommendation is
"delete", STOP and confirm with the user before deleting** — removing something
a developer may already be using from Storybook is not reversible for them.

> **✅ RESOLVED (2026-08-20).** The delete-vs-finish question dissolved: a usable
> component already exists *and* is already registered and installable (see the
> correction in §1.2). Neither branch applied. The recommendation — move the
> stories file into `date-picker/` — was reported to and confirmed by the
> coordinator before any file was touched. Nothing was deleted.

### 1.5 Out of scope

- Adding *features* to any block.
- Changing block markup, except where an e2e test reveals a genuine bug.
- Redesigning the registry category taxonomy beyond separating directives.
- Building `date-range-picker` into a full component **unless** Task 1 concludes
  that is the cheaper, better option and the user agrees.

---

## 2. QA section — write these tests FIRST

### 2.1 Traceability

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `login: fills credentials, submits, asserts submit event` | UC-1 | e2e |
| T-2 | `signup: validation blocks empty submit, then succeeds` | UC-1 | e2e |
| T-3 | `forgot-password: submits an email and shows confirmation` | UC-1 | e2e |
| T-4 | `dashboard: stat tiles render values; chart renders` | UC-1 | e2e |
| T-5 | `settings-profile: edits a field and submits` | UC-1 | e2e |
| T-6 | `settings-account: toggles a setting and submits` | UC-1 | e2e |
| T-7 | `pricing: every plan CTA is clickable and emits` | UC-1 | e2e |
| T-8 | `hero: primary and secondary CTAs are clickable` | UC-1 | e2e |
| T-9 | `features: all feature items render` | UC-1 | e2e |
| T-10 | `faq: clicking a question expands its answer` | UC-1 | e2e |
| T-11 | **deliberate-regression check** — break one block, prove its spec fails, restore | UC-2 | manual, recorded in retro |
| T-12 | `impact analyzer selects a block spec when that block changes` | UC-3 | unit (impact.ts) |
| T-13 | `registry validator passes; no component files[] changed` | UC-8 | unit |
| T-14 | `directives are discoverable as directives` | UC-5, UC-6 | unit (CLI list/search) |

### 2.2 The deliberate-regression requirement (T-11)

`e2e/README.md` documents a deliberate-regression recipe. **Use it.** An e2e
suite that has never been observed failing is not known to test anything —
this is the single most valuable test in this spec, because the entire premise
is that the current smoke coverage gives false confidence.

Record the outcome in the task retrospective: which block was broken, how, and
that the spec caught it.

### 2.3 Coverage expectation

No unit-coverage change expected — this is e2e and metadata work. The registry
validator and impact analyzer changes must not reduce their existing coverage.

---

## 3. Architecture

### 3.1 Usability / DX

Blocks live in `packages/blocks/` (a separate top-level package from
`packages/components/ui/`). The e2e harness convention is one folder per
registry name under `e2e/harness/<name>/`, auto-discovered by the orchestrator —
so single-block specs need **no** edit to `e2e/orchestrator/specs.ts`.

Per `.claude/CLAUDE.md`: *"DO NOT manually edit `e2e/orchestrator/specs.ts` for
single-component specs."* Only multi-component installs or non-default
`initArgs` belong in `EXPLICIT_SPECS`. Blocks that pull in several components
(e.g. `login` needs input, label, button, card) install via the registry's
dependency resolution, so they remain single-name specs.

Use `npm run e2e:scaffold -- <name>` to generate each harness, then replace the
generated smoke assertions with the real interactions from §2.1.

### 3.2 Efficiency

Ten new e2e specs add real wall-clock time to the full suite. Each block spec
must stay lean: one install, one page, the interactions listed — no redundant
navigation. Budget: ≤45s per block spec.

> **Measured (2026-08-20).** Warm-worker times, which is what the marginal cost
> actually is: `pricing` 9.4s, `signup` 12.4s, `settings-account` 13.1s,
> `settings-profile` 14.2s, `hero` 20.1s, `dashboard` 36.2s, and `faq`,
> `features`, `forgot-password` in the same 10-20s band. **Every block spec is
> inside the ≤45s budget.** `dashboard` is the most expensive because it
> installs a chart and a table.
>
> The large numbers visible in a cold run (~400s) are a *per-worker* one-off —
> the first spec on each of the 4 workers pays for that worker's fixture
> `npm install`. That cost is amortised across the whole 169-spec suite and is
> not attributable to these ten. Aggregate added worker time is roughly 2.5
> minutes, which at 4 workers is well under a minute of added wall clock.

### 3.3 Implementation options — directive discoverability

**Option 1 — New `directives` registry category.**
Pros: clean separation; `list` and `search` group them naturally; matches how a
developer thinks.
Cons: changes the registry's category enum, which the CLI validates — and per
`.claude/CLAUDE.md`, a change to the **manifest shape** requires an npm publish.
Must confirm whether adding a category *value* counts as a shape change (it
likely does not, since `category` is a string field) — **verify before
assuming**.

**Option 2 — Keep categories, add a `kind: 'component' | 'directive' | 'pipe'`
field.** More expressive, but this *is* a manifest shape change and forces a
publish.

**Option 3 — Documentation only** — a directives section in the docs, no
registry change. Zero risk, zero publish, but does not fix `list`/`search`.

**✅ Chosen: Option 1, contingent on Task 6's verification** that adding a
category value is not a manifest-shape change. If it turns out to require a
publish, fall back to Option 3 and record why. Option 2 is rejected: the extra
expressiveness is not worth forcing a CLI release.

> **➡ CONTINGENCY FIRED — Task 6 verdict (2026-08-20): fall back to Option 3.**
>
> Two separate questions, and they have different answers:
>
> 1. *Is adding a category value a manifest-**shape** change?* **No.**
>    `isValidRegistryEntry` in `packages/cli/src/registry/load.ts` checks only
>    `name` (string), `files` (array), and the optional `addons` / `testFiles` /
>    `testDependencies` string arrays, plus addon-specific fields when
>    `type === 'addon'`. It **never inspects `category`**. `Category` in
>    `ComponentDefinition` is a compile-time TS union with no runtime presence.
>    So an already-installed CLI parses a `registry.json` carrying
>    `category: "directives"` without complaint — no publish required *for
>    parsing*.
> 2. *Does Option 1 nonetheless require a publish to deliver its value?*
>    **Yes — and this is what fires the contingency.** The entire benefit of
>    Option 1 is the grouping in `list`/`help`, and that grouping is bundled CLI
>    code: `buildComponentsSection()` in `packages/cli/src/commands/help.ts`
>    loops over the CLI's **own** `CATEGORIES` const and `continue`s past any
>    group it does not recognise. Until a release shipped the new `CATEGORIES` +
>    `CATEGORY_LABELS` entries, every already-installed CLI would render the
>    directives **nowhere at all** in `help` — strictly *worse* discoverability
>    than today, which is the exact opposite of UC-5/UC-6.
>
> Also noted while verifying: `list` prints bare names with one exception —
> `addonSuffix()` renders `(addon of <parent>)` off the `type` data field. That
> is the affordance directives lack, but reaching it means adding a
> `type: 'directive'` value, which *is* Option 2 (rejected by this spec) and
> *is* a manifest-shape change.
>
> **Delivered instead (Option 3, zero publish):** `docs/directives.md` covering
> all 10 directive entries with selector, host element, and behaviour; plus T-14
> locking in the pre-existing "description starts with `Directive`" convention,
> which is what makes `search` / `why` / MCP output self-identifying today
> (`search` prints `name [category] description`). No registry data changed, so
> T-13 holds trivially.

### 3.4 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Block e2e specs pass without asserting anything meaningful | T-11 deliberate regression is mandatory, not optional |
| R-2 | Deleting `date-range-picker` removes something a user wanted | Task 1 investigates and **asks the user** before deleting |
| R-3 | Category change forces an unwanted npm publish | Task 6 verifies against `isValidRegistryShape` before changing anything |
| R-4 | Ten new e2e specs slow the suite unacceptably | Per-spec budget in §3.2; report total added time in the retro |
| R-5 | Writing e2e for blocks uncovers real bugs, expanding scope | Fixing a bug the test reveals is in scope; redesigning the block is not. Report and ask if the fix is large |

---

## 4. Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — full server scan (`npm run coverage` then
   `unset SONAR_TOKEN; npm run sonar`) clean on changed code. If
   token/server/Docker unavailable, the task is **blocked, not done**.
5. **Review gate ≥ 91** — invoke the `review-gate` skill.

Then update the task row with **Completed**, **Score**, **Retrospective**.

---

## 5. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Investigate `date-range-picker` orphan; report completeness and a delete-vs-finish recommendation. **Ask the user before deleting.** | UC-4 | ✅ Done | 2026-08-20 | see log | Premise was false. The component exists (`date-picker/sub/date-range-picker.component.*`), is exported from the barrel, and is already in `date-picker`'s `files[]` — `add date-picker` installs it today. Only the stories file was misplaced. Recommended move, not delete; reported and confirmed before touching anything. Nothing deleted. |
| 2 | Scaffold e2e harnesses for all 10 blocks (`e2e:scaffold`); confirm auto-discovery without editing `specs.ts` | UC-1, UC-3 | ✅ Done | 2026-08-20 | see log | `e2e:scaffold` could not scaffold a block at all — it hardcoded `packages/components/ui`, emitted `@/components/ui/<name>` imports, and assumed the tag was `ui-<name>`. Made it registry-driven and taught it to read the real `selector`. All 10 then scaffolded and auto-discovered (159 → 169 specs) with zero edits to `specs.ts`. |
| 3 | Write real interaction specs T-1…T-6 (the six form-bearing blocks) | UC-1 | ✅ Done | 2026-08-20 | see log | T-2 was unwritable as specified: `signup` had no validation at all and emitted empty submissions. Added block-local validation. `settings-profile` needed unambiguous locators — `getByLabel('Name')` also matched "Username", and the `placeholder` matched both the `<ui-textarea>` host and its inner control. |
| 4 | Write real interaction specs T-7…T-10 (marketing blocks) | UC-1 | ✅ Done | 2026-08-20 | see log | T-7 was unwritable as specified: every `pricing` CTA was `<ui-button [label]="tier.cta" />` with no handler and no output — literally the spec's own "dead link in pricing" example. Added `ctaClicked`. `features` asserts the per-name `ui-icon-<name>` hook because `ui-icon` renders an empty `<svg>` for an unknown name rather than throwing. |
| 5 | **Deliberate-regression check T-11** — break a block, prove the spec fails, restore. Record in retro. | UC-2 | ✅ Done | 2026-08-20 | see log | Re-injected the real bug: deleted `(clicked)="ctaClicked.emit(tier)"` from `pricing.component.html`, making it byte-identical to its pre-fix state. `npm run e2e -- pricing` FAILED on "every plan CTA emits its own tier" (`getByTestId('picked')` → element(s) not found). Restored; re-ran; 2 passed. Decisive detail: the *rendering* test passed throughout — the exact false confidence `add-all-smoke` gives. |
| 6 | Verify whether a new registry category value is a manifest-shape change (`isValidRegistryShape`, `ComponentDefinition`); record the finding | UC-5 | ✅ Done | 2026-08-20 | see log | Not a shape change — `isValidRegistryEntry` never inspects `category` and `Category` is compile-time only, so old CLIs parse it fine. But Option 1 still needs a publish to be *worth* anything: `help.ts` groups by the CLI's own bundled `CATEGORIES` and skips unknown ones, so until a release shipped, directives would vanish from `help` entirely. Contingency fired → Option 3. |
| 7 | Apply the chosen directive-discoverability option; T-13, T-14 pass | UC-5, UC-6, UC-8 | ✅ Done | 2026-08-20 | see log | Delivered `docs/directives.md`. Found **10** directive entries, not the 6 the spec lists. All 10 already open their description with "Directive", which is what makes `search`/`why` self-identifying; T-14 locks that in and derives the set from `files[]` so new directives inherit the rule. T-13: `check:registry` reports "All components and blocks are in sync" — no `files[]` changed. |
| 8 | Resolve `date-range-picker` per Task 1's approved recommendation | UC-4 | ✅ Done | 2026-08-20 | see log | Moved `date-range-picker.stories.ts` into `date-picker/` and repointed its imports at `./sub/date-range-picker.component` and `../calendar`. Storybook's glob is `../packages/**/*.stories.*`, so it is still collected; the file is in no `files[]`, so the registry is untouched. |
| 9 | Move `rich-text-editor.ideas.md` out of `ui/` into `specs/`; confirm registry unaffected | UC-7 | ✅ Done | 2026-08-20 | see log | Moved to `specs/`. It was the only `.md` under `ui/`. Registry unaffected — confirmed by `check:registry`. |
| 10 | Add T-12 impact-analyzer test; run `e2e:impact` and confirm block specs are selected | UC-3 | ✅ Done | 2026-08-20 | see log | Found the analyzer was blind to blocks: `getComponentForFile` matches only `ui/` and `lib/`, so a block edit scheduled **nothing** — UC-3 could not have held. Added `blockForFile` in `impact.ts` (not CLI source: the analyzer is its only caller, so no publish). T-12 asserts every block file maps back to its block and that every block has a schedulable spec. |

## 6. Completion log

### T-11 — deliberate regression (2026-08-20)

The single most valuable check in this spec, per §2.2. Recorded in full
because "the suite passed" is not evidence that the suite tests anything.

| Step | Action | Result |
|---|---|---|
| 1 | Deleted the line `(clicked)="ctaClicked.emit(tier)"` from `packages/blocks/pricing/pricing.component.html`, restoring the block to byte-identical pre-fix state | block compiles, page renders |
| 2 | `npm run e2e -- pricing` | **FAILED** — `pricing: every plan CTA emits its own tier` → `expect(locator).toHaveText("Free\|$0") failed … element(s) not found` on `getByTestId('picked')`. Exit code 1. |
| 3 | `git checkout -- packages/blocks/pricing/pricing.component.html` | restored |
| 4 | `npm run e2e:reset` then `npm run e2e -- pricing` | **2 passed**, `1/1 passed` |

The finding that matters: in step 2 the *other* test in the same file —
`pricing: all three tiers render with their prices and features` — **passed**.
That test is the kind of coverage `add-all-smoke` already provided, and it was
blind to a CTA that did nothing. The interaction assertion is what caught it.
This is the spec's premise, demonstrated rather than asserted.

### Defects found by writing the tests

All three were pre-existing on `master` and none were visible to the existing
smoke coverage.

1. **`pricing` — dead CTAs (fixed).** Every plan button was
   `<ui-button [label]="tier.cta" />`: no click handler, no output, no way for
   a consumer to know a plan was chosen. This is verbatim the "dead link in
   `pricing`" that §1.2 names as the motivating failure. Fixed additively with
   `ctaClicked = output<PricingTier>()`.
2. **`signup` — no validation (fixed).** `onSubmit()` emitted unconditionally,
   so submitting an untouched form emitted `{name:'', email:'', password:'',
   acceptTerms:false}`. Fixed with block-local validation and an inline error;
   no base-component change.
3. **`ui-textarea` — unlabelled control (NOT fixed; follow-up).** The component
   exposes no `elementId`/`ariaLabel`/`ariaLabelledby` input and renders a bare
   `<textarea>`, so `settings-profile`'s `<ui-label>Bio</ui-label>` is
   decorative and the field is unnamed for assistive tech (WCAG 3.3.2 / 4.1.2).
   Deliberately left alone: the fix belongs in a shared base component, outside
   this bundle's remit. The spec locates that field by `data-slot` with a
   comment recording why.

### Infrastructure gaps that made the stated goals unreachable

Both were discovered by attempting the tasks as written, and both are dev-only
(no npm publish implied).

- **`e2e:scaffold` could not scaffold a block.** It hardcoded
  `packages/components/ui`, emitted `@/components/ui/<name>` imports, and
  derived the element tag from the registry name. Blocks live in
  `packages/blocks/`, install to `@/blocks/`, and are `ui-login-block` — not
  `ui-login`. Now registry-driven, with the tag read from the component's real
  `selector` (which also hardens it for any component whose selector does not
  match its folder name).
- **The impact analyzer was blind to blocks.** `getComponentForFile` matches
  only `packages/components/{ui,lib}/`, so every `packages/blocks/**` change
  mapped to no component and scheduled **nothing** — not even that block's own
  spec. UC-3 could not have held. Fixed with `blockForFile` inside
  `e2e/orchestrator/impact.ts` rather than in CLI source: the analyzer is that
  function's only caller, so keeping it out of `packages/cli/` avoids implying
  a release.

### UC-3 verified end-to-end, both directions (2026-08-20)

Asserting "the analyzer now picks up blocks" is worth nothing without showing
what it did before. Both runs used a scratch commit whose only changed file was
`packages/blocks/faq/faq.component.ts`:

| Analyzer | `npm run e2e:impact -- --base HEAD~1` |
|---|---|
| With `blockForFile` disabled (pre-fix behaviour) | `decision: none` → **`NONE`** — CI would have run **no specs at all** for a block change |
| With `blockForFile` (as shipped) | `decision: subset (1 specs)` → **`faq`** |

So before this change a block could be broken arbitrarily and the impacted-spec
job would have short-circuited to "nothing to run". The scratch commit and the
temporary stub were both removed; `git status` is clean at `b088d30e`.

### Amendments to the spec itself

Per the living-history convention, wrong claims are struck through and
annotated in place, never deleted: the `date-range-picker` "orphan" premise
(§1.2), the six-directive count (§1.2), and the Option 1 decision (§3.3).

### Wall-clock cost of the new specs

See the note under §3.2.
