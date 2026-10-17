# `--include-tests` Under a Custom Prefix — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set. It builds on two **completed** specs and must not undo them:
> `selector-independent-component-identity-spec.md` (the prefix transform and
> its `createComponent`-under-a-non-`ui-`-host test technique, its V-6 and V-8)
> and the `--include-tests` feature (`project_include-tests-feature`: the
> `portable-tests.json` gate and the two-leg verify driver).

**Status:** ⬜ Not started
**Date:** 2026-10-17
**Source:** follow-up V-6 of `selector-independent-component-identity-spec.md`,
carried in `codebase-review-fixes-index.md` ("Recorded out of scope").
**Living history:** never delete a completed row, a fixed bug or a superseded
decision — mark it and append below.

---

## Step 0 — verification record

Re-measured against the tree at branch `chore/backlog-sweep` (2026-10-17). The
original follow-up said "131 calls in 62 spec files"; that figure was taken on
2026-10-04 and is **stale**.

| # | Claim | What the source says today |
|---|-------|----------------------------|
| V-1 | `add --include-tests --prefix acme` ships spec files that fail in the consumer. | ✅ Confirmed by reading: shipped specs go through `transformSource` → `applyPrefixTransforms` (`packages/cli/src/core/fetch.ts:83-95`, `core/install.ts:61`). `applyPrefixTransforms` rewrites `selector:` metadata and `<ui-` / `</ui-` tags in `.ts` files, so **test-host templates are already correct** (about 320 such lines in the shipped specs). It does **not** touch a `ui-` element name inside a string handed to a query. |
| V-2 | "131 calls / 62 files". | ⚠️ **Stale.** `registry.json` now ships **254 spec files for 157 components**. A scan of those files for `closest` / `matches` / `querySelector` / `querySelectorAll` / `By.css` whose first argument contains a `ui-` element token finds **100 calls in 41 files** (`By.css` 45, `querySelector` 39, `querySelectorAll` 15, `closest` 1). The scan is a regex and **under-counts**: it misses `querySelector<HTMLElement>('ui-…')` (a generic argument sits between the name and the parenthesis), e.g. `button/confirm.directive.spec.ts` `document.body.querySelector<HTMLElement>('ui-confirm-dialog ui-alert-dialog-cancel')`, and about 30 more string uses fall in a bucket the regex could not classify. **Task 1 replaces the regex with an AST scan and records the real number.** |
| V-3 | Every `ui-` string in a spec is a selector. | ❌ Refuted. Three kinds are **not** element selectors and must keep working: a `localStorage` key `'ui-color-picker:swatches'` (the component itself hard-codes it, `color-picker.component.spec.ts`), a CSS **class** `ui-icon` / `ui-icon-check` (`icon.component.spec.ts`, class names are never prefix-rewritten) and the attribute `data-ui-theme`. A fix that rewrites "anything starting `ui-`" breaks these. |
| V-4 | Only `.spec.ts` files are shipped. | ✅ True for components; `testDependencies[]` also ships spec-only sibling sources (`portable-tests.json`). Task 1 must scan those too. |
| V-5 | The verify driver can exercise a prefixed install. | ❌ Not today. `packages/cli/scripts/verify-portable.ts` has no prefix argument and `e2e/jest-fixture/run.mjs` never mentions one: **no gate in the repo has ever installed specs under a prefix.** That is why the problem was found by reading, not by a failing check. |
| V-6 | A guard exists against the combination. | ❌ None: `--include-tests` with `--prefix` installs silently. |
| V-7 | A shipped spec can locate parts without a tag name. | ✅ Components carry `data-slot` (CLAUDE.md checklist; `npm run check:completeness` enforces it), and `By.directive(Class)` finds a rendered component by its class, which is prefix-independent. |

**Why the existing tests let this through** (CLAUDE.md "When a bug gets past the
tests"): the portable gate, the jest fixture and the browser suite all install or
run with the **default** prefix, so every sample of the input class had `ui-` in
it. Answer **case 2**: the missing input class is "installed under a non-`ui-`
prefix"; it is added to the existing verify gate (Task 4), not as a one-off test
named after this report.

---

## PM section

### Business logic

A developer who runs `npx shadcn-angular init --prefix acme` and then
`add <component> --include-tests` gets component tests that pass in their
project, exactly as they do with the default prefix. Shipped tests never depend
on the library's own default tag name.

### Why the customer wants this

`--include-tests` exists so a consumer's coverage gate does not fail on newly
added, untested files. A consumer who chose a prefix to avoid colliding with
another library (the stated purpose of `--prefix`) is **today** handed 41 spec
files in which some tests fail, e.g. `By.css('ui-command-item')` finds nothing
under `acme-command-item`. The workarounds are to delete the failing specs
(which brings the coverage gate back) or to skip `--include-tests`. Either one
defeats the feature for the very customer who customised the most.

### Use cases = definition of done

| ID | Use case |
|----|----------|
| UC-1 | After `init --prefix acme` and `add <C> --include-tests`, running the shipped specs of every component in the **affected set** (Task 1 records it) passes under **vitest + jsdom**. |
| UC-2 | The same set passes under **jest + jest-preset-angular** (the consumer runner the repo supports). |
| UC-3 | With the default prefix the shipped specs are unchanged in meaning and still pass; the CLI's output for `ui` is **byte-identical** to before this spec for every non-spec file. |
| UC-4 | A contributor who writes a shipped spec that selects a library element by a `ui-` tag name gets a **registry-lint error naming the file and line**, not a surprise in a consumer's project. A `localStorage` key, a CSS class or a `data-ui-*` attribute containing `ui-` does **not** trigger it. |
| UC-5 | A prefixed install with `--include-tests` is covered by a **gate that fails if it regresses** (not a one-time manual run). |
| UC-6 | The README "Custom component prefix" section no longer carries a `--include-tests` caveat; if anything is still unsupported it says exactly what. |
| UC-7 | No behaviour of any component changes; only specs (and, where a spec needs a hook, an existing `data-slot` attribute that is already part of the component's contract). |

### Explicitly out of scope

- Rewriting test code in the CLI (see Option 1 below — ruled out).
- Making the repository's **own** suite run under a non-`ui-` prefix. (The
  rewritten specs will make that closer; it is not a goal and not gated.)
- The edit-detection gap for prefixed CSS / `<ng-content select>` (V-5 of the
  identity spec; unchanged).
- Any change to which components ship tests (`portable-tests.json` `verified`).

---

## QA section

> Tests are written **first**. Each is red on the current tree for the reason
> stated.

### Traceability

| Test | Name | Proves | Type | Red today because |
|------|------|--------|------|-------------------|
| T-1 | `the shipped specs of the affected set pass when installed under --prefix acme (vitest, jsdom)` | UC-1 | verify leg (`verify-portable.ts --prefix acme`) | 41+ files select by `ui-` |
| T-2 | `… (jest, jest-preset-angular)` | UC-2 | verify leg (`--jest --prefix acme`) | same |
| T-3 | `the default-prefix install is byte-identical for non-spec files, and its specs still pass` | UC-3 | CLI unit + existing verify leg | guards against a regression |
| T-4 | `lintPortableSpec flags a library tag name used as a selector` — table over `By.css('ui-x')`, `querySelector('ui-x .y')`, `querySelector<HTMLElement>('ui-x')`, `querySelectorAll(\`ui-x\`)`, `closest("ui-x")`, `matches('ui-x')`, `getElementsByTagName('ui-x')`, `tagName` / `localName` compared to `'UI-X'` / `'ui-x'` | UC-4 | unit (`sync-registry-lib.spec.ts`) | rule does not exist |
| T-5 | `lintPortableSpec accepts non-selector uses of "ui-"` — `localStorage.getItem('ui-color-picker:swatches')`, `classList.contains('ui-icon')`, `hasAttribute('data-ui-theme')`, `By.css('[data-slot="command-item"]')`, `By.directive(CommandItemComponent)`, a `ui-x` inside a comment | UC-4 | unit | prevents over-reach (V-3) |
| T-6 | `sync-registry fails when a verified component's spec selects by tag name` (integration over a fixture registry) | UC-4 | unit | rule does not exist |
| T-7 | `e2e prefix-include-tests: init --prefix acme; add split-button chat tree-select command --include-tests; the consumer's own test script is green` | UC-5, UC-1 | e2e (`EXPLICIT_SPECS`, `initArgs: ['--prefix','acme']`) | no such spec |
| T-8 | `README names no --include-tests caveat` | UC-6 | gate evidence (reviewer reads it; recorded in the log) | caveat present |
| T-9 | `git diff --stat` for the change touches only `*.spec.ts`, `*.stories.ts` (if a story shares a helper), the lint, the verify scripts, e2e files and docs | UC-7 | gate evidence | — |

### Test types and edge cases

- **Inputs, as classes** (CLAUDE.md "Writing Tests" step 2): a prefix that is
  one word (`acme`), a prefix that contains a hyphen (`my-co`), the default
  `ui` (must be a no-op), and a prefix that is a **prefix of another** (`u`,
  which must not rewrite `ui-`); sample one of each in T-3 / T-7.
- **Mutation check before done:** (a) revert one rewritten spec to its `ui-`
  selector — T-1/T-2 or T-4 must go red; (b) make the lint ignore
  `querySelector<…>(` — T-4 must go red; (c) make the lint also flag `'ui-icon'`
  class checks — T-5 must go red.
- **Coverage expectation:** the lint additions are fully covered by T-4 / T-5 /
  T-6; spec edits change no coverage numbers (components' source is untouched).

---

## Architecture section

### Usability — the consumer's view

```bash
npx shadcn-angular init --prefix acme
npx shadcn-angular add split-button command tree-select --include-tests
npm test          # green, with no manual edits
```

There is **no new flag, option or type**. The behaviour is that the sentence
"works with any prefix" stays true when tests are included.

For a contributor writing a shipped spec, the rule and its two sanctioned
idioms:

```ts
// ❌ names the library's default tag; breaks under --prefix acme
fixture.debugElement.queryAll(By.css('ui-command-item'));

// ✅ by class — prefix-independent
fixture.debugElement.queryAll(By.directive(CommandItemComponent));

// ✅ by slot — prefix-independent (every component carries data-slot)
(fixture.nativeElement as HTMLElement).querySelectorAll('[data-slot="command-item"]');
```

### Efficiency

No runtime effect (test scaffolding only). Gate cost: one more install-and-run
of the verify driver. Budget: the prefixed vitest/jsdom leg ≤ **1.5×** the
default leg's wall-clock; the jest leg runs only the **affected set** (about 41
files, not all 157 components), not `--all`.

### DX for the consuming developer

Nothing to learn. If a future spec breaks the rule the **contributor** sees
`registry lint: split-button/split-button.component.spec.ts:44 selects a
library element by tag name ('ui-button'); use By.directive(ButtonComponent) or
[data-slot="button"] so the spec survives --prefix` from `sync-registry`.

### Implementation options

**Option 1 — rewrite string selectors in the CLI.** Extend
`applyPrefixTransforms` to find `ui-` element tokens inside string and template
literals handed to the query functions, in spec files only.
Pros: no spec edits; one place.
Cons: it is a regex over **test code** with an open-ended surface — generic
call arguments, template literals with `${}`, selectors built from constants,
`By.css` wrapped in helpers — and every miss is a failure in a *consumer's*
project, found by them. It also needs the neutralisation machinery
(`neutralizePrefix`, baselines) to learn a fourth position, and V-3 shows it
must tell element names from keys, classes and attributes by context. The
transform already has two known blind spots (identity spec V-5); this adds a
third.

**Option 2 — make the shipped specs prefix-independent at the source, and gate
it.** Change the 41+ specs to `By.directive(Class)` / `[data-slot]`, add a
registry-lint rule that rejects the tag-name idiom in verified specs, and add a
`--prefix` leg to the verify driver and one e2e spec.
Pros: no magic; the tests state what they mean (they find the *component*, not
a string that happens to be its tag); the same specs keep working if a
component's selector is ever renamed; the rule is enforced where specs are
authored, with a precise message; consistent with the selector-independence
direction the repo already chose.
Cons: touches ~40 spec files; a few elements have no `data-slot` and no
importable class (then a stable hook must be added to the component — see Risks).

**Option 3 — refuse or silently skip tests when a prefix is set.**
Pros: five lines.
Cons: removes the feature for exactly the customers who asked to customise;
silently skipping is a surprise. As a **temporary guard** it is acceptable
(a `warnings[]` line) but it is not the deliverable.

**✅ Chosen: Option 2.** Option 1 moves a correctness problem from the
repository, where a contributor sees it, to the consumer, where they cannot.
Option 3 is rejected as the answer; it may be used only as the interim guard in
Task 2 if the work is split across commits, and is removed in the same PR.

### Risks

| Risk | Mitigation |
|------|------------|
| An element has neither a `data-slot` nor an importable class | Add the missing `data-slot` to the component template **only if** the completeness gate (`check:completeness`, data-slot) would require it anyway; otherwise query a parent slot and descend by role. Record each in the log. A new attribute is a contract addition, not a behaviour change (UC-7). |
| A spec asserts on the *tag* itself (e.g. `nativeElement.tagName`) | Compare against the component's own host element (`fixture.debugElement.query(By.directive(X)).nativeElement.localName`), never a literal. |
| The lint over-reaches on legitimate `ui-` strings (V-3) | T-5 is a table of the exact non-selector uses found today. |
| The prefixed jest leg is slow | Run it only for the affected set; the vitest/jsdom leg runs `--all`. |
| Changing spec text changes a test's meaning | Each edited spec is re-run in the repo's browser leg **and** both portable legs; mutation check (a) above. |

---

## Task table (order = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests **T-4, T-5, T-6** (lint) and replace the regex census with a TypeScript-AST scan (`packages/cli/scripts/` helper, reused by the lint) that lists every `ui-` element token used as a selector in shipped specs and `testDependencies`; record the real count and the affected-component set in the log | UC-4 | ⬜ Not started | — | — | — |
| 2 | Add `--prefix <p>` to `verify-portable.ts` and to `e2e/jest-fixture/run.mjs` (install with `init --prefix`); write **T-1, T-2, T-3** — red on the stubs for the reason in the table. Interim: a `warnings[]` guard in `add` for `--include-tests` + custom prefix is allowed *only* until Task 5 | UC-1, UC-2, UC-3, UC-5 | ⬜ Not started | — | — | — |
| 3 | Implement the lint rule in `lintPortableSpec` (`sync-registry-lib.ts`); T-4, T-5, T-6 green; it must **fail** on the unmodified specs (that is the work list) | UC-4 | ⬜ Not started | — | — | — |
| 4 | Convert the specs, one commit per ~8 files, grouped by component folder: `By.css('ui-x')` → `By.directive(X)`; DOM `querySelector('ui-x')` → `[data-slot="x"]`; re-run each in the browser leg and both portable legs after every group. Add a missing `data-slot` only per the Risks row | UC-1, UC-2, UC-7 | ⬜ Not started | — | — | — |
| 5 | Remove the interim guard if one was added; T-1, T-2 green for the whole affected set; T-3 green | UC-1–3, UC-5 | ⬜ Not started | — | — | — |
| 6 | Add the e2e spec **T-7** to `EXPLICIT_SPECS` (`initArgs: ['--prefix','acme']`, `names` = the four components); run it via `npm run e2e -- prefix-include-tests`; `npm run e2e:reset` after | UC-5 | ⬜ Not started | — | — | — |
| 7 | README "Custom component prefix": drop the `--include-tests` caveat (**T-8**); regenerate docs (`npm run docs:regen`, `docs:check`); run the mutation checks (a)–(c) | UC-6 | ⬜ Not started | — | — | — |
| 8 | Close: `npm run check:all`, `check:registry` (testFiles are regenerated by `sync-registry --fix`, never by hand), `npm run test-visual`, `npm run verify:portable -- --all` and `--all --jest`, impacted e2e, `npm run sonar:gate` with the four-condition verdict from CLAUDE.md §4. **T-9** diff check. **Publish consequence:** spec files and registry data are served live from `master`; this is a CLI publish only if `packages/cli/src/**` logic changed (it should not; the lint lives under `scripts/`) — confirm with `release-cli`'s verdict | all | ⬜ Not started | — | — | — |

---

## Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — the **full server scan** (`npm run sonar:gate`
   against `http://localhost:9000` — coverage re-measured unless the tree
   fingerprint proves it current) run and clean on the changed code. eslint is
   NOT a substitute. If the token, server, or Docker is unavailable, the task is
   **blocked, not done** — stop and tell the user.
5. **Review gate ≥ 91** — invoke the `review-gate` skill and reach a score of
   at least 91 from a fresh independent reviewer.

Then, and only then, update this spec's task row with:

- **Completed** — the date/time (`date +"%Y-%m-%d %H:%M"`).
- **Score** — the review-gate score.
- **Retrospective** — 1–2 sentences: what went well, and what to improve later.

Marking a row Done without all five is a process violation, not a shortcut.

---

## Completion log

_Append per task: the AST census (count and affected set), the red lists, the
mutation-check results, gate evidence._

| Date | Task | Event |
|------|------|-------|
| 2026-10-17 | — | Spec written from the V-6 follow-up. Step 0 re-measured the claim: **100 selector calls in 41 files** (regex lower bound), not 131 in 62; test-host templates are already rewritten; `localStorage` keys, CSS classes and `data-ui-*` attributes must stay out of any rule (V-3); no gate has ever installed specs under a prefix (V-5). |
