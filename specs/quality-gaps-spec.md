# Quality Gaps — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately.
>
> It touches `e2e/`, `packages/blocks/`, one orphaned stories file, and the
> registry's category metadata. No other Wave 0 bundle touches these.

**Status:** not started
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

- **`date-range-picker` orphan**: a flat `date-range-picker.stories.ts` sits
  under `ui/` with no registry entry, no component folder, and no way to
  install it. It appears in Storybook, so a developer can find it, want it, and
  then discover `add date-range-picker` fails. That is worse than it not
  existing.
- **Directive discoverability**: `input-mask`, `context-menu-attach`,
  `copy-to`, `tree-context-menu`, `table-context-menu`,
  `data-table-context-menu` are registered under `utility` / `form` categories
  alongside components. They are a different kind of thing — used as attributes,
  not elements — and a developer browsing by category will not find them.
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
| 1 | Investigate `date-range-picker` orphan; report completeness and a delete-vs-finish recommendation. **Ask the user before deleting.** | UC-4 | ⬜ Not started | — | — | — |
| 2 | Scaffold e2e harnesses for all 10 blocks (`e2e:scaffold`); confirm auto-discovery without editing `specs.ts` | UC-1, UC-3 | ⬜ Not started | — | — | — |
| 3 | Write real interaction specs T-1…T-6 (the six form-bearing blocks) | UC-1 | ⬜ Not started | — | — | — |
| 4 | Write real interaction specs T-7…T-10 (marketing blocks) | UC-1 | ⬜ Not started | — | — | — |
| 5 | **Deliberate-regression check T-11** — break a block, prove the spec fails, restore. Record in retro. | UC-2 | ⬜ Not started | — | — | — |
| 6 | Verify whether a new registry category value is a manifest-shape change (`isValidRegistryShape`, `ComponentDefinition`); record the finding | UC-5 | ⬜ Not started | — | — | — |
| 7 | Apply the chosen directive-discoverability option; T-13, T-14 pass | UC-5, UC-6, UC-8 | ⬜ Not started | — | — | — |
| 8 | Resolve `date-range-picker` per Task 1's approved recommendation | UC-4 | ⬜ Not started | — | — | — |
| 9 | Move `rich-text-editor.ideas.md` out of `ui/` into `specs/`; confirm registry unaffected | UC-7, UC-8 | ⬜ Not started | — | — | — |
| 10 | Add T-12 impact-analyzer test; run `e2e:impact` and confirm block specs are selected | UC-3 | ⬜ Not started | — | — | — |

---

## 6. Completion log

_(empty — no tasks complete yet)_
