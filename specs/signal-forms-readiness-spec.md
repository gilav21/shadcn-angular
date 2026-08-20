# Signal Forms Readiness — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **However — this spec must land BEFORE any other bundle that edits form
> controls** (`form-controls-small`, `form-builder`, `crud-page`). It touches
> the most widely-shared files in the library. Running it in parallel with
> those bundles will cause conflicts.

**Status:** not started
**Owner:** unassigned
**Source plan:** `specs/ideas-backlog-2026-08-19.md` §2 "Signal Forms without
dropping Angular 20"

---

## 1. Product Manager section

### 1.1 Business logic

Angular 21 ships **Signal Forms** (`@angular/forms/signals`), a signal-native
forms system that replaces `ReactiveFormsModule`'s observable/`FormControl`
model with a `FieldTree` bound through a `Field` directive.

For a component to be usable inside a signal form, it must satisfy the
`FormValueControl<T>` contract (or `FormCheckboxControl` for booleans). The
contract's only mandatory requirement, quoted from `@angular/forms@21.2.17`
`types/signals.d.ts`:

> *"The value is the only required property in this contract. A component that
> wants to integrate with the `Field` directive via this contract **must**
> provide a `model()` that will be kept in sync with the value of the bound
> `FieldTree`."*

Every other member — `disabled`, `required`, `pattern`, `min`, `max`, `errors`,
`name`, `focus()` — is optional and auto-synced when present.

This spec makes the library's form controls satisfy that contract. It does
**not** adopt Signal Forms internally, and it does **not** remove
`ControlValueAccessor` support.

### 1.2 Why the customer wants this

A developer on Angular 21 who adopts Signal Forms today **cannot use this
library's form controls inside a signal form at all.** The `Field` directive
silently refuses a control whose `value` is not a `ModelSignal`, so the
developer's options are: drop back to reactive forms for the whole form, hand-
write a wrapper component per control, or use native inputs and lose the
library.

That is the pain. It has no good workaround, and it gets worse as Signal Forms
adoption grows.

### 1.3 The Angular 20 question — answered

**Satisfying `FormValueControl` requires no import from
`@angular/forms/signals`.** It is a *structural* contract: a component whose
`value` is a `ModelSignal` already conforms. `model()` has existed since
Angular 17.2, so the converted components compile **identically on Angular 20**.

Therefore: no addon, no version gate, no conditional import, no peer-dependency
bump, and **no reason to defer**. Angular 20 support is free.

Only *demos, tests and docs* that import `form()`, `Field`, or the validators
(`required`, `email`, `min`, `validateAsync`, `validateHttp`, …) are
Angular-21-only. Those never ship into a consumer's app.

### 1.4 Use cases — definition of done

| ID | Use case |
|---|---|
| **UC-1** | A developer binds `[(value)]` on every converted control and two-way binding behaves exactly as it did before this change. |
| **UC-2** | A developer uses any converted control inside a `ReactiveFormsModule` form with `formControlName` and it behaves exactly as before. |
| **UC-3** | A developer on Angular 21 binds a converted control with the Signal Forms `[field]` directive and edits flow both ways between the control and the `FieldTree`. |
| **UC-4** | A developer on Angular 20 installs and builds any converted control with no error, no warning, and no missing-export failure. |
| **UC-5** | A developer reads a converted control's exported types and can see it conforms to `FormValueControl<T>` — the conformance is asserted in a type test, not merely implied. |
| **UC-6** | Setting `disabled` through a signal form disables the control, for the controls that expose a `disabled` input. |
| **UC-7** | No converted control emits a duplicate or double-fired change event after conversion. |

### 1.5 Out of scope

- Rewriting any component to *use* Signal Forms internally.
- Removing or deprecating `ControlValueAccessor`.
- Adding validators, error display, or a form-level component.
- `field` component changes — `ui-field` keeps its current `NgControl` wiring.
- Converting non-form components that happen to have a `value` input
  (`progress`, `gauge-chart`, `tabs-trigger`, `accordion-item`, …). These are
  **not** form controls and must be left alone.

---

## 2. QA section — write these tests FIRST

> **Write every test below before any implementation.** Each test must fail
> first against the current code, then pass after conversion. This is what
> keeps the conversion honest.

### 2.1 Traceability

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `two-way [(value)] updates the model on user input` | UC-1 | unit, per control |
| T-2 | `two-way [(value)] updates the view when the model changes` | UC-1 | unit, per control |
| T-3 | `works with formControlName and reports value to the form group` | UC-2 | unit, per control |
| T-4 | `writeValue from the form updates the rendered value` | UC-2 | unit, per control |
| T-5 | `binds to a signal-forms FieldTree via [field] and round-trips edits` | UC-3 | unit (Angular 21 only) |
| T-6 | `type-asserts the component satisfies FormValueControl<T>` | UC-5 | type test |
| T-7 | `builds against Angular 20 with no signals import` | UC-4 | e2e / build check |
| T-8 | `disabled from the field state disables the control` | UC-6 | unit, where applicable |
| T-9 | `emits valueChange exactly once per user interaction` | UC-7 | unit, per control |
| T-10 | `does not re-emit when writeValue is called with the current value` | UC-7 | unit, per control |

### 2.2 Type test for UC-5

A compile-time assertion, one per converted control:

```ts
// no runtime cost; fails the build if the contract regresses
const _conforms: FormValueControl<string> = null as unknown as InputComponent;
```

Guard the import so it never ships: keep these in `*.types.spec.ts` files
excluded from the registry `files[]`.

### 2.3 Edge cases every control must cover

- Empty / null initial value.
- Programmatic change while the control is focused (must not fight the user).
- `disabled` set before *and* after first render.
- RTL rendering unchanged.
- Touch interaction unchanged.
- **Feedback-loop check**: `writeValue` must not re-emit and re-enter. See
  Risk R-3.

### 2.4 Coverage expectation

No uncovered lines introduced in any converted file. Every converted control
keeps or improves its current coverage percentage.

---

## 3. Architecture

### 3.1 Usability — the target API

Identical to today for existing users; additionally valid in a signal form:

```html
<!-- unchanged: two-way binding -->
<ui-input [(value)]="name" />

<!-- unchanged: reactive forms -->
<ui-input formControlName="name" />

<!-- new: signal forms (Angular 21+) -->
<form [formRoot]="userForm">
  <ui-input [field]="userForm.name" />
</form>
```

### 3.2 Efficiency

No runtime cost. `model()` is one signal plus one output — strictly less
machinery than the hand-written `input()` + `output()` pair it replaces in
seven of the components.

### 3.3 DX for the consuming developer

Nothing new to learn. The change is **invisible** to existing consumers and
additive for signal-forms users. No migration note is needed for the
input+output components because their public template API is byte-identical.

### 3.4 The verified inventory

Audited across the 28 `ControlValueAccessor` components on 2026-08-19.
**Task 1 re-verifies this table before any edit** — treat it as a starting
point, not gospel.

| Current shape | Components | Action |
|---|---|---|
| `value`/`checked` already a `model()` | `input-otp`, `checkbox`, `switch` | **None** — already compliant. Add the type test only. |
| `value = input()` **+** `valueChange = output()` | `autocomplete`, `select`, `number-input`, `phone-input`, `radio-group`, `slider`, `toggle-group` | Collapse the pair into `value = model()`. |
| `value = signal()` (internal state only) | `input`, `textarea`, `rating`, `color-picker`, `input-group-input` | Promote the internal signal to `value = model()`. |

### 3.5 Implementation options

**Option 1 — Convert `value` to `model()` in each component.**
Pros: satisfies the contract structurally with zero new imports; compiles on
Angular 20; non-breaking for the input+output group because `[(value)]` already
works via the manual pair; removes duplicated declarations; no new files.
Cons: touches ~12 components; the `value = signal()` group needs care so
`writeValue` does not loop.

**Option 2 — Ship a per-component adapter directive** that wraps the existing
CVA control and exposes a `model()`.
Pros: leaves existing components untouched.
Cons: doubles the API surface; the consumer must know to import an extra thing;
an adapter cannot satisfy a *structural* contract on the component itself, so
`[field]` still would not accept `<ui-input>` directly — it would only work on
the wrapper. This defeats the purpose.

**Option 3 — Defer until Angular 20 is dropped.**
Pros: nothing to do now.
Cons: based on the false premise that signal-forms support requires an Angular
21 import. It does not. Deferring costs the first-mover window for no benefit.

**✅ Chosen: Option 1.** It is the only option that makes the library's own
components valid signal-forms controls, it is free on Angular 20, and for seven
of the twelve components it is a pure simplification — collapsing a hand-rolled
`input`+`output` pair into the primitive that exists for exactly that purpose.

### 3.6 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | `model()` auto-creates a `valueChange` output; components that already declare one will fail to compile with a duplicate. | Expected and desired — the compiler finds every case. Delete the manual output as part of each conversion. |
| R-2 | Promoting an internal `signal()` to a `model()` makes previously-private state writable from outside. | Review each of the five for state that must stay internal; if any exists, keep it as a separate private signal and expose only `value`. |
| R-3 | **`color-picker` is known to echo `colorChange` on `writeValue`, creating a feedback loop** (see project memory). Converting to `model()` could widen the loop. | Do `color-picker` **last**, as its own task, with T-10 written first. Fix the echo as part of the conversion rather than around it. |
| R-4 | A converted control double-emits: once from `model()` and once from a leftover manual emit in an event handler. | T-9 asserts exactly one emission per interaction, per control. |
| R-5 | The Angular-20 claim is asserted but never tested. | T-7 builds the fixture app against Angular 20 in CI-less local e2e. If pinning Angular 20 in the fixture proves impractical, downgrade to a static check that no converted file imports `@angular/forms/signals`, and say so in the retro. |

---

## 4. Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — the **full server scan** (`npm run coverage`
   then `npm run sonar` against `http://localhost:9000`) run and clean on the
   changed code. eslint is NOT a substitute. If the token, server, or Docker is
   unavailable, the task is **blocked, not done** — stop and tell the user.
5. **Review gate ≥ 91** — invoke the `review-gate` skill and reach a score of
   at least 91 from a fresh independent reviewer.

Then, and only then, update this spec's task row with **Completed** (date/time),
**Score**, and a 1–2 sentence **Retrospective**.

Marking a row Done without all five is a process violation, not a shortcut.

---

## 5. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Re-verify §3.4 inventory against source; correct the table in this spec if it drifted | — | ⬜ Not started | — | — | — |
| 2 | Write failing tests T-1…T-4, T-9, T-10 for the three already-compliant controls (`input-otp`, `checkbox`, `switch`) as the reference harness | UC-1, UC-2, UC-7 | ⬜ Not started | — | — | — |
| 3 | Add T-6 type tests for the three compliant controls; establish the `*.types.spec.ts` pattern excluded from registry `files[]` | UC-5 | ⬜ Not started | — | — | — |
| 4 | Convert `select` (input+output → model) — the reference conversion for the pattern | UC-1, UC-2, UC-3 | ⬜ Not started | — | — | — |
| 5 | Convert `autocomplete`, `number-input`, `phone-input` | UC-1, UC-2, UC-3 | ⬜ Not started | — | — | — |
| 6 | Convert `radio-group`, `slider`, `toggle-group` | UC-1, UC-2, UC-3 | ⬜ Not started | — | — | — |
| 7 | Convert `input` and `textarea` (internal signal → model) | UC-1, UC-2, UC-3 | ⬜ Not started | — | — | — |
| 8 | Convert `rating` and `input-group-input` | UC-1, UC-2, UC-3 | ⬜ Not started | — | — | — |
| 9 | Convert `color-picker` **and fix the `writeValue` echo loop** (R-3) | UC-1, UC-7 | ⬜ Not started | — | — | — |
| 10 | Add T-5 signal-forms `[field]` round-trip tests across all converted controls | UC-3 | ⬜ Not started | — | — | — |
| 11 | Add T-8 `disabled`-from-field tests where a `disabled` input exists | UC-6 | ⬜ Not started | — | — | — |
| 12 | Add T-7 Angular 20 build check (or the documented fallback from R-5) | UC-4 | ⬜ Not started | — | — | — |
| 13 | Update Storybook stories + demo pages to show the signal-forms usage; add the recipe to docs | UC-3, UC-5 | ⬜ Not started | — | — | — |

---

## 6. Completion log

_(empty — no tasks complete yet)_
