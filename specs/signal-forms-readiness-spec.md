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

#### 2.2.a Where they live, and why (settled in Task 3)

`*.types.spec.ts` files live in **`packages/components/signal-forms/`**, one
per control, *not* beside the component.

Co-locating them would have shipped them. `sync-registry`'s
`collectPortableSpecs` claims **every** non-`.browser` spec sitting in a
directory a component's `files[]` occupy and writes it into that component's
`testFiles[]`, which `add --include-tests` installs into the consumer's
project. These files import `@angular/forms/signals`, which does not exist on
Angular 20 — shipping them would break precisely the consumers UC-4 promises
not to break. Naming them `*.types.spec.ts` does not exempt them; only the
`.browser.spec.ts` suffix or living outside `ui/` does.

Verified, not assumed: `npx tsx packages/cli/scripts/sync-registry.ts` reports
"All components and blocks are in sync" with the three files on disk, i.e. no
entry claimed them.

The assertion form used is the typed-local one — `const control:
FormCheckboxControl = fixture.componentInstance;` — on a real fixture instance
rather than `null as unknown as T`, so the same line doubles as a runtime check
that the member really is a settable, subscribable model. These files are still
typechecked by `npm run typecheck` (no `include` in `tsconfig.json`, so they are
in the program) and still run under vitest.

#### 2.2.b What T-6 caught on the "already compliant" three

`input-otp` did **not** conform. `maxLength = input(6)` is
`InputSignal<number>`, and `FormUiControl` reserves that name for
`InputSignal<number | undefined>`; the assignment fails on `transformFn`
contravariance. This is a runtime defect, not a typing technicality: the
`Field` directive binds `maxLength` from the field's schema, and a field with
no max-length rule binds `undefined` — which the old input would have handed
to `Array.from({ length: … })`, rendering **zero** slots. Fixed by widening the
input and resolving the default once through a new `slotCount()` computed that
every internal length calculation reads.

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

#### 3.1.a Correction (Task 10) — the released API is `[formField]`

The sketch above predates the release. In `@angular/forms@21.2.17` there is no
`[field]` and no `[formRoot]`: the directive is `FormField`, selector
`[formField]`, and it is bound per control.

```html
<!-- what actually compiles -->
<ui-input [formField]="userForm.name" />
```

`form()` also accepts a `WritableSignal` of a primitive, so a single control
can bind a root field directly — which is what the T-5 hosts do.

A second discovery from writing those tests, and the more consequential one:
**when a component provides `NG_VALUE_ACCESSOR`, `FormField` binds through the
CVA in preference to the value model** — it calls `writeValue` on the way in and
registers `onChange` into the field state on the way out (see
`node_modules/@angular/forms/fesm2022/signals.mjs`, the `controlValueAccessor`
getter and the binding effect beneath it). So for the fifteen CVA controls the
value traffic still flows through the accessor; the `model()` is what makes them
*conform*, what the optional members bind through, and what carries the three
non-CVA controls (`input-otp`, `slider`, `toggle-group`). This is why the T-5
tests drive user-facing methods rather than writing to `value` directly: a bare
`value.set()` does not call `onChange`, so it never reaches the `FieldTree`.

### 3.2 Efficiency

No runtime cost. `model()` is one signal plus one output — strictly less
machinery than the hand-written `input()` + `output()` pair it replaces in
five of the components (see the re-verified inventory in 3.4.b).

### 3.3 DX for the consuming developer

Nothing new to learn. The change is **invisible** to existing consumers and
additive for signal-forms users. No migration note is needed for the
input+output components because their public template API is byte-identical.

#### 3.3.a Correction (Task 4) — one migration note *is* needed

The template API is byte-identical, but the **emitted type is not**. A control
whose selection can be empty must be `model<T | undefined>(undefined)`, and
Angular derives the output type from the model, so `valueChange` now emits
`T | undefined` where the hand-written `output<T>()` emitted `T`. Any handler
that assigns straight into a non-optional target stops compiling under
`strictTemplates`:

```html
<!-- was fine, now errors: Type 'undefined' is not assignable to type 'Align' -->
<ui-select [value]="align()" (valueChange)="align.set($event)" />

<!-- fix: narrow at the call site, or widen the target -->
<ui-select [value]="align()" (valueChange)="align.set($event ?? 'center')" />
```

This is a compile-time break only — the control still never emits `undefined`,
because emission happens on a user pick alone. It was found by
`npm run typecheck:templates`, which caught exactly one occurrence in the demo
app; `tsc --noEmit` does **not** catch it, so every conversion task must run
the template check, not just the type check.

### 3.4 The verified inventory

Audited across the 28 `ControlValueAccessor` components on 2026-08-19.
**Task 1 re-verifies this table before any edit** — treat it as a starting
point, not gospel.

#### 3.4.a Original audit (2026-08-19) — superseded, kept for history

| Current shape | Components | Action |
|---|---|---|
| `value`/`checked` already a `model()` | `input-otp`, `checkbox`, `switch` | **None** — already compliant. Add the type test only. |
| `value = input()` **+** `valueChange = output()` | `autocomplete`, `select`, `number-input`, `phone-input`, `radio-group`, `slider`, `toggle-group` | Collapse the pair into `value = model()`. |
| `value = signal()` (internal state only) | `input`, `textarea`, `rating`, `color-picker`, `input-group-input` | Promote the internal signal to `value = model()`. |

#### 3.4.b Re-verified inventory (Task 1, 2026-08-20) — authoritative

Method: `NG_VALUE_ACCESSOR` / `ControlValueAccessor` grep over
`packages/components/ui/**/*.component.ts`, then a per-component read of the
`value` / `checked` declaration. **Angular in the workspace is 21.2.17**, so
`@angular/forms/signals` (`FormValueControl`, `FormCheckboxControl`, `form()`,
`Field`) is available for the type and round-trip tests.

**Drift found — five corrections:**

1. **There are 18 CVA components, not 28.** Full list: `autocomplete`,
   `checkbox`, `chip-list`, `color-picker`, `date-picker`,
   `date-range-picker` (sub), `input`, `input-group-input` (sub),
   `native-select`, `number-input`, `phone-input`, `radio-group`, `rating`,
   `rich-text-editor`, `select`, `switch`, `textarea`, `tree-select`.
2. **`input-otp`, `slider` and `toggle-group` are not CVA components at all.**
   They are still in scope — Signal Forms conformance is independent of CVA —
   but UC-2 / T-3 / T-4 (reactive-forms tests) **do not apply** to them.
3. **`slider` and `toggle-group` are mis-grouped.** Neither has a `value`
   *input*; both hold an internal `signal()` plus a manual `valueChange`
   output. They belong to the "internal signal" group, so the
   input+output group is **five** components, not seven.
   - `slider`: `value = signal(0)` + `valueChange = output<number>()`, seeded
     from a separate `defaultValue = input(0)` read once in the constructor.
   - `toggle-group`: `value = signal<string[]>([])` +
     `valueChange = output<string | string[]>()`.
4. **`color-picker` is worse than "an internal signal".** Its public
   `readonly value = signal(0)` is the **HSV brightness channel**, not the
   colour; the canonical colour lives in a private `rgba` signal and is only
   readable through `currentColor()` / `colorChange`. There is **no colour
   input at all** — the colour can only be set through `writeValue`. Task 9
   therefore has to (a) rename the HSV channel signal (e.g. `hsvValue`) to
   free the `value` name and (b) introduce `value = model<string>('')` as the
   hex colour. The `writeValue` echo of R-3 is **already fixed** in the current
   source (`suppressedColor` + `isProgrammatic` guard, `color-picker.
   component.ts`); Task 9's job is to keep that guarantee across the
   conversion, not to discover it.
5. **Six CVA components are outside this spec's task list** and are left
   untouched: `chip-list` (`chips = signal<string[]>([])`), `native-select`,
   `tree-select` (`value = input()`), `date-picker` (`date` input +
   `dateChange` output), `date-range-picker`, `rich-text-editor`. They are
   genuine form controls and *should* be converted, but no numbered task
   covers them — recorded here as follow-up work for a later spec.

| Current shape | Components | CVA? | Action |
|---|---|---|---|
| `value` / `checked` already a `model()` | `input-otp` (`value`), `checkbox` (`checked`), `switch` (`checked`) | otp: no; checkbox/switch: yes | **None** — already compliant. Type test only. `checkbox`/`switch` conform to `FormCheckboxControl`, not `FormValueControl`. |
| `value = input()` **+** `valueChange = output()` | `autocomplete`, `select`, `number-input`, `phone-input`, `radio-group` | yes | Collapse the pair into `value = model()`. |
| internal `signal()` (+ manual `valueChange` output where present) | `input`, `textarea`, `rating`, `input-group-input`, `slider`, `toggle-group` | slider/toggle-group: no; rest: yes | Promote the internal signal to `value = model()`; delete the manual output where one exists. |
| special case | `color-picker` | yes | `value` name is taken by the HSV channel and there is no colour input. Rename the channel, add `value = model<string>('')`. Task 9. |
| not in this spec's task list | `chip-list`, `native-select`, `tree-select`, `date-picker`, `date-range-picker`, `rich-text-editor` | yes | Deliberately untouched — follow-up spec. |

**Contract detail that constrains the type tests (T-6):** the optional members
of `FormUiControl` are typed, not merely named — `disabled` must be
`InputSignal<boolean>`, `name` must be `InputSignal<string>`, `min`/`max` must
be `InputSignal<number | undefined>`. A component whose `name` is
`InputSignal<string | undefined>` (e.g. `input`) or whose `min` is
`InputSignal<number>` (e.g. `slider`) will **fail** a bare
`FormValueControl<T>` assignment even after `value` becomes a `model()`. Where
that happens the type test asserts against `FormValueControl<T>` with the
conflicting members `Omit`-ed and records the mismatch, rather than widening a
public input purely to satisfy a structural check.

### 3.5 Implementation options

**Option 1 — Convert `value` to `model()` in each component.**
Pros: satisfies the contract structurally with zero new imports; compiles on
Angular 20; non-breaking for the input+output group because `[(value)]` already
works via the manual pair; removes duplicated declarations; no new files.
Cons: touches 12 components (11 conversions + `color-picker`, per the
re-verified inventory in 3.4.b); the internal-`signal()` group needs care so
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
pair into the primitive that exists for exactly that purpose. Those seven are
the five `value = input()` + `valueChange = output()` controls plus `slider`
and `toggle-group`, whose internal signal is likewise paired with a manual
`valueChange` output.

#### 3.5.a The conversion pattern, as settled by the reference conversion

Every conversion in tasks 5–9 follows the shape Task 4 established:

1. `value = model<T | undefined>(undefined)` replaces the `value` input.
2. The hand-written `valueChange = output<T>()` is **deleted** — Angular
   derives the output from the model, and keeping both fails to compile (R-1).
3. **The internal state signal stays.** This is the part that is not obvious:
   `model()` fires its output on *every* `.set()`, including one made from
   `writeValue`. The `ControlValueAccessor` contract requires the opposite —
   a form write must not echo back — and so does the `defaultValue` seed. So
   programmatic writes go to the internal signal alone and stay silent, while a
   user-driven change goes through a single private `commit()` that writes both
   and therefore emits exactly once.
4. Every user-driven path funnels through that one `commit()`. Grep for
   `.emit(` afterwards: there must be none left in the component or its `sub/`.
5. Run **`npm run typecheck:templates`**, not just `tsc --noEmit` — the widened
   emission type of §3.3.a is only visible to the template checker.

#### 3.5.b Amendment (Tasks 7–8) — when the second signal is not needed

Rule 3 above exists for one reason: a hand-written `valueChange` output whose
documented contract promised silence on a programmatic write. Five controls had
no such output before this bundle — `input`, `textarea`, `rating`,
`input-group-input` and `color-picker`'s colour — so there is no promise to
keep, and they are converted with the model as the single source of truth. A
`writeValue` therefore *does* reach the new `valueChange`, which is the better
behaviour for them: a `[(value)]` binding stays in step with the form instead of
drifting from it.

T-10 is unchanged for these: a write of the value already held emits nothing,
by signal equality. That, and the once-per-edit guarantee, are pinned in
`packages/components/signal-forms/single-signal-emission.spec.ts` rather than
left to the prose above.

`rating` keeps its pre-existing `ratingChange` output on the old terms — user
picks only — alongside the new `valueChange`, and the same file pins the
difference.

Known, accepted limitation of the two-signal shape: after a reactive form calls
`writeValue`, `value()` still reads the pre-write value, so a control bound to
`formControlName` *and* read through `value()` / `[field]` at the same time
would see them diverge. That combination is not one of the three supported
usage modes, and each converted component documents it on the `value` model.

### 3.6 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | `model()` auto-creates a `valueChange` output; components that already declare one will fail to compile with a duplicate. | Expected and desired — the compiler finds every case. Delete the manual output as part of each conversion. |
| R-2 | Promoting an internal `signal()` to a `model()` makes previously-private state writable from outside. | Review each of the six for state that must stay internal; if any exists, keep it as a separate private signal and expose only `value`. |
| R-3 | **`color-picker` is known to echo `colorChange` on `writeValue`, creating a feedback loop** (see project memory). Converting to `model()` could widen the loop. | Do `color-picker` **last**, as its own task, with T-10 written first. Fix the echo as part of the conversion rather than around it. |
| R-4 | A converted control double-emits: once from `model()` and once from a leftover manual emit in an event handler. | T-9 asserts exactly one emission per interaction, per control. |
| R-5 | The Angular-20 claim is asserted but never tested. | T-7 builds the fixture app against Angular 20 in CI-less local e2e. If pinning Angular 20 in the fixture proves impractical, downgrade to a static check that no converted file imports `@angular/forms/signals`, and say so in the retro. |

---

## 4. Definition of Done (per task)

> **Cadence amendment (2026-08-20, orchestrator decision).** The rigour is
> unchanged, the cost is not. **Per task:** targeted tests for the changed
> files, `npm run lint` clean, review gate ≥ 91. **Once per bundle, after the
> last task:** the full `npm run coverage` + full server scan
> (`SONAR_PROJECT_KEY=shadcn-angular-signal-forms`, per-agent project so
> parallel agents do not pollute each other's verdict), with every issue on the
> changed code fixed and re-scanned until clean. Nothing merges unscanned or
> unreviewed — the full scan simply stops re-running per task over code that has
> not changed. Criteria 2 and 4 below are therefore bundle-level.

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
| 1 | Re-verify §3.4 inventory against source; correct the table in this spec if it drifted | — | ✅ Done | 2026-08-20 | 97 | The audit had drifted on five points — 18 CVA components not 28, three listed controls are not CVA at all, `slider`/`toggle-group` were mis-grouped, and `color-picker`'s `value` is the HSV channel with no colour input. Recorded as §3.4.b with §3.4.a kept for history; counts in §3.2/§3.5/§3.6 were re-derived to match. |
| 2 | Write failing tests T-1…T-4, T-9, T-10 for the three already-compliant controls (`input-otp`, `checkbox`, `switch`) as the reference harness | UC-1, UC-2, UC-7 | ✅ Done | 2026-08-20 | 94 | 16 tests added across the three specs; they pass on arrival because these controls are already `model()`-based, which is the point — they pin the behaviour the conversions must reproduce. T-3/T-4 are omitted for `input-otp` with an in-file justification, since §3.4.b established it is not a `ControlValueAccessor`. |
| 3 | Add T-6 type tests for the three compliant controls; establish the `*.types.spec.ts` pattern excluded from registry `files[]` | UC-5 | ✅ Done | 2026-08-20 | 93 | The pattern is settled in §2.2.a: the files live in `packages/components/signal-forms/`, because a `*.types.spec.ts` beside the component would be collected into `testFiles[]` and shipped to Angular 20 consumers. T-6 immediately earned its keep — `input-otp` did not actually conform, and its `maxLength` would have rendered zero slots when a `[field]` binding pushed `undefined`. |
| 4 | Convert `select` (input+output → model) — the reference conversion for the pattern | UC-1, UC-2, UC-3 | ✅ Done | 2026-08-20 | 95 | The naive single-signal collapse is wrong: `model()` emits on every `.set()`, so `writeValue` would have echoed and broken the CVA contract. Keeping the internal signal for silent programmatic writes and funnelling user picks through one `commit()` preserves every existing behaviour while making `value` a real `ModelSignal`; recorded as the pattern in §3.5.a. |
| 5 | Convert `autocomplete`, `number-input`, `phone-input` | UC-1, UC-2, UC-3 | Done | 2026-08-21 | 95 | Same pattern as select. Two findings the tests caught rather than the compiler: autocomplete's value effect turned a null write into a selection of `[null]` instead of clearing, and `model()`'s equality dedupe means an interaction that changes nothing no longer emits - four number-input tests now assert that silence. |
| 6 | Convert `radio-group`, `slider`, `toggle-group` | UC-1, UC-2, UC-3 | Done | 2026-08-21 | 95 | radio-group followed the pattern; the other two did not, because 3.4.b had them mis-grouped. slider's min/max needed widening (a schema with no min/max rule pushes `undefined`, which made every percentage NaN), and toggle-group needed its model seeded `undefined` so the sync effect could not clobber the defaultValue seed. |
| 7 | Convert `input` and `textarea` (internal signal → model) | UC-1, UC-2, UC-3 | Done | 2026-08-21 | 94 | These never had a valueChange output, so nothing promised silence on a programmatic write and the model can be the single source of truth - recorded as 3.5.b, with the emission behaviour pinned in code rather than asserted in prose. Their T-6 assertions omit `name`, which is where the widen-only-if-it-breaks-at-runtime line got drawn. |
| 8 | Convert `rating` and `input-group-input` | UC-1, UC-2, UC-3 | Done | 2026-08-21 | 94 | Same single-signal shape; rating keeps ratingChange on its old user-picks-only terms alongside the new valueChange. rating's `max` was the third contract-reserved input needing a resolved computed - unresolved, a schema push of `undefined` renders no stars at all. |
| 9 | Convert `color-picker` **and fix the `writeValue` echo loop** (R-3) | UC-1, UC-7 | Done | 2026-08-21 | 94 | The riskiest one needed renaming before converting: `value` was the HSV brightness channel and the colour had no input at all. The echo guard was already in place and the job was not widening it - T-10 was written first and covers both outputs. |
| 10 | Add T-5 signal-forms `[field]` round-trip tests across all converted controls | UC-3 | Done | 2026-08-21 | 92 | All fourteen controls round-trip through a real form. Two API facts the spec could not have known: the directive is `[formField]`, not `[field]`, and a ControlValueAccessor takes precedence over the value model - recorded as 3.1.a. |
| 11 | Add T-8 `disabled`-from-field tests where a `disabled` input exists | UC-6 | Done | 2026-08-21 | 92 | Covered in the same file as T-5, across three distinct disable mechanisms (native attribute, CVA setDisabledState, and the component's own computed). |
| 12 | Add T-7 Angular 20 build check (or the documented fallback from R-5) | UC-4 | Done | 2026-08-21 | 92 | R-5's documented fallback rather than an Angular 20 build: no file under ui/ or lib/ may import the Angular-21-only entrypoint, with a positive control so an empty glob fails instead of passing vacuously. |
| 13 | Update Storybook stories + demo pages to show the signal-forms usage; add the recipe to docs | UC-3, UC-5 | PARTIAL | 2026-08-21 | 92 | Docs recipe written and accurate against the released API. Stories were skipped for a real reason - a story lives under ui/, where the T-7 invariant forbids the signals import - but the demo page lives in demo/, outside that invariant, so it was skipped for scope, not principle. Outstanding. |
| 14 | **From `quality-gaps`:** give `ui-textarea` the label-association API `ui-input` already has — `elementId` + `resolvedId` computed, `[attr.id]` on the `<textarea>`, `ariaLabel` / `ariaLabelledby` / `ariaDescribedby`. Additive only; does **not** touch the `settings-profile` block (that stays with `quality-gaps`). Routed here because Task 7 already edits this file. | WCAG 3.3.2 / 4.1.2 | Done | 2026-08-21 | 92 | A faithful, purely additive mirror of ui-input's label API, including moving a natively-written host id onto the real control. Unblocks the settings-profile e2e workaround in quality-gaps. |

---

## 6. Completion log

| Task | Completed | Score | Reviewer rationale (compressed) |
|---|---|---|---|
| 1 — Re-verify the §3.4 inventory | 2026-08-20 | 97 | Every factual claim in §3.4.b independently reverified against source and confirmed: the 18-component CVA list, the three non-CVA controls, the `slider`/`toggle-group` regrouping, and the `color-picker` HSV/echo-guard analysis. The typed-`FormUiControl` claim was checked against `signals.d.ts` and the worked mismatches are genuine. Every count in §3.2/§3.5/§3.6 reconciles arithmetically with the authoritative table, and the 3.4.a/3.4.b split is unambiguous. |
| 2 — Reference test harness (T-1…T-4, T-9, T-10) | 2026-08-20 | 94 | Each test proves what it claims and none is vacuous: T-9 asserts the emission array equals exactly one element and T-10 drives `writeValue`/`.set()` with the current value, so a future double-emit or re-emit loop would genuinely fail. The `input-otp` T-3/T-4 omission was independently verified against the source and is correctly documented. Nits: `input-otp` T-10 has to poke the model directly for want of a `writeValue`, and the FormGroup value assertions lean on loose FormGroup typing. |
| 3 — T-6 type tests + the `*.types.spec.ts` pattern | 2026-08-20 | 93 | The assertions are real rather than vacuous — the files are in the `tsc` program, so a regression from `model()` to `input()` fails `npm run typecheck` — and the `input-otp` `maxLength` widening is a genuine contract fix, not gold-plating, with every internal read routed through `slotCount()` and the default preserved for existing consumers. The §2.2.a placement rationale was independently verified against `collectDirSpecs`, which only scans inside `ui/`. Nits raised and both fixed before commit: the edit had rewritten `input-otp.component.ts` to LF against a CRLF file, and a sub-component doc comment still said `maxLength`. |
| 4 — Convert `select` (reference conversion) | 2026-08-20 | 95 | The two-signal design is the correct choice rather than a compromise, since a single-signal collapse could not keep `writeValue`/`defaultValue` silent as UC-2 and the existing suite require. R-4 is fully satisfied — no `.emit()` survives anywhere in the select folder, every selection flows through one `commit()`, and T-9/T-10 plus two added silence tests pin it. The accepted `value()`-vs-`writeValue` drift is documented on the model itself, and the §3.3.a note on the widened emission type is accurate with the right minimal demo fix. |
| 5 - Convert autocomplete, number-input, phone-input | 2026-08-21 | 95 | All six follow the 3.5.a pattern exactly and a grep for `.emit(` across them turns up nothing but autocomplete's unrelated searchChange. The four number-input tests changed to assert silence are a defensible reading of T-10 rather than a papered-over regression, tested with concrete emitted-array assertions. |
| 6 - Convert radio-group, slider, toggle-group | 2026-08-21 | 95 | slider's resolvedMin/resolvedMax are used at every internal read site and in the template; toggle-group's undefined-seeded model is justified by the effect-after-ngOnInit ordering, and the round-trip test exercises the real [formField] path end to end. The public `value` shape change on toggle-group is acknowledged and has no in-repo consumer. |
| 7 - Convert input and textarea | 2026-08-21 | 94 | Re-reviewed after fixes (76 then 94): the unused `signal` import was removed and the missing T-9/T-10 coverage for the single-signal group was written, so the design decision is verified in code rather than argued in prose. |
| 8 - Convert rating and input-group-input | 2026-08-21 | 94 | rating's resolvedMax is correctly threaded through every star-count site including the template, and ratingChange still fires on user picks only. |
| 9 - Convert color-picker and hold the echo guard | 2026-08-21 | 94 | The two-effect design converges without looping - the `written === currentColor()` guard plus consuming suppressedColor once - and the new tests genuinely prove T-1/T-2/T-9/T-10 on both outputs. |
| 10 - T-5 field round-trip | 2026-08-21 | 92 | The CVA-precedence claim reverifies against signals.mjs, and the two unusual assertions (select's internalValue, phone's +44) are correct rather than bent to fit the code. All fourteen controls are driven from both ends, non-tautologically. |
| 11 - T-8 disabled from the field | 2026-08-21 | 92 | Covers three distinct disable mechanisms correctly. |
| 12 - T-7 Angular 20 check | 2026-08-21 | 92 | Has a real positive control and correctly restricts its glob to ui/ and lib/, matching collectDirSpecs - so the "not shipped" claim for the conformance folder holds. |
| 13 - Docs recipe (PARTIAL) | 2026-08-21 | 92 | Docs verified accurate against the installed @angular/forms. The stated reason covered the skipped stories but not the skipped demo page, which lives outside the invariant - a disclosure gap, corrected in the task row. |
| 14 - ui-textarea label association | 2026-08-21 | 92 | A byte-faithful, purely additive mirror of input.component.ts, confirmed line for line. |

## Breaking change for consumers — widened output types

**Found at integration, 2026-08-21.** Converting a control from
`input()` + `output<T>()` to `value = model<T | undefined>()` widens the
public `valueChange` type: it now emits `undefined` as well as `T`.

This is **correct** — a signal-forms control must be able to represent "unset",
and several controls genuinely clear (`toggle-group` in `single` mode returns
to `undefined` when the active item is re-pressed). But it is a **breaking
change** for any consumer that assigns `$event` straight into a non-nullable
signal or field:

```ts
// Before: compiled.  After: TS2345 — 'undefined' is not assignable.
protected readonly picked = signal<string | string[]>('');
// <ui-toggle-group (valueChange)="picked.set($event)">
```

Consumers must widen the receiving type (or narrow at the call site). This
belongs in the release notes for the publish this wave requires.

**Only `toggle-group`'s e2e harness caught it**, because it is the one harness
that assigns `$event` into a typed signal. The workspace demo build did not:
its own bindings happened to be compatible. Every converted control has the
same widened surface — the absence of further failures means no other harness
exercises the assignment, **not** that no other control widened.

### The failure message actively misled

The e2e runner reported:

```
✗ toggle-group   123.8s  ng serve did not become ready within 120000ms
```

There was no timeout. `ng serve` never became ready **because the build failed**
on TS2345, and the runner only reports the readiness deadline it was waiting
on. A compile error presented as an infrastructure flake — and it survived a
full suite run being written off as contention. Worth surfacing the build's
own error in the runner's failure text.
