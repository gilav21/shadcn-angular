# Slider & Numeric Input Correctness — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **Shared-file note (not a prerequisite):** `toggle-group-and-input-otp-forms-spec.md`
> also edits `packages/components/signal-forms/field-round-trip.spec.ts` and
> `docs/signal-forms.md` (the same "CVA wins over the model" paragraph). The two
> specs can run in parallel; whichever merges second resolves a small textual
> conflict in those two files. Nothing else overlaps.

**Status:** not started
**Owner:** unassigned
**Source:** codebase review findings, 2026-10-03 (slider / number-input / time-picker)

---

## 0. Step 0 — findings re-verified against the source (2026-10-03)

Every finding was checked by reading the source and its spec file, and, where
the claim was about native browser behaviour, by running the native element in
Playwright Chromium (`HTMLInputElement.stepUp/stepDown` and range-value
sanitising). Corrections are marked ⚠️ and keep the original claim.

| # | Finding as reported | Verdict | Evidence |
|---|---|---|---|
| F-1 | `slider.component.ts:81-86` reads `defaultValue()` in the constructor, before input binding → `[defaultValue]="40"` always starts at 0. No test. | ✓ **True.** Signal inputs are not bound at construction time, so the constructor always reads the default `0`. The JSDoc at `:47` even documents "read once in the constructor". No test in `slider.component.spec.ts` sets `defaultValue`. | Broken call sites: `demo/.../inputs/slider-demo.component.ts:17` (`[defaultValue]="40"`), `demo/.../patterns/dock-demo.component.ts:39,46` (`[min]="40"` + `[defaultValue]` → starts at **0, below min**), `demo/.../data-display/icon-demo.component.html:279-286` (`[min]="0.5" [defaultValue]="2"`), `slider.stories.ts:31,63,68`. `demo/src/app/css-settings.component.ts:116-129,163-164` works around it with `viewChild(...).value.set(...)`. The e2e harness (`e2e/harness/slider/slider-demo.component.ts`) binds `[defaultValue]="0"` — the degenerate input that equals the model default, which is why it never caught this. |
| F-2 | Snapping ignores `min`: `Math.round(v/step)*step` → min 1, step 2 can reach 6; keyboard adds raw floats → step 0.1 gives `0.30000000000000004`. | ✓ **True**, and wider than reported. Pointer: `slider.component.ts:243` (`Math.round(5.6/2)*2 = 6`). Keyboard: `:185,190,202,206` add raw `step` (`0.2+0.1 = 0.30000000000000004`). Pointer with fractional step drifts too: `Math.round(2.3/0.1)*0.1 = 2.3000000000000003` — this is the icon demo's live stroke-width slider. **Also:** `End` sets `max` even when `max` is not on the grid (min 1, step 2, max 10 → 10; native range gives 9), and a value written from outside is never brought onto the grid (native range sanitises `0.625` with step `0.05` to `0.65`). | Node: `0.2+0.1`, `Math.round(2.3/0.1)*0.1`. Chromium: range min 1 max 10 step 2 value `6` → `7`, value `10` → `9`; range step 0.05 value `0.625` → `0.65`. |
| F-3 | Hidden range input has no `(input)`/`(change)` → mobile screen-reader increment gestures change it without updating the model. | ✓ **True.** `slider.component.html:7-18` binds only `(keydown)`. VoiceOver/TalkBack adjust a range by setting its value and firing `input`/`change`, which nothing listens to, so the DOM and the model diverge. | — |
| F-4 | Document mouse/touch listeners not removed if destroyed mid-drag. | ✓ **True**, plus a sibling: `touchcancel` is not handled either (`:138-150`), so a cancelled touch (incoming call, OS gesture) also leaks the `touchmove` listener. Listeners are removed only by `mouseup` (`:158-161`) / `touchend` (`:144-147`); there is no `DestroyRef`. | — |
| F-5 | Slider has no ControlValueAccessor. | ✓ **True.** No `NG_VALUE_ACCESSOR`. Confirmed also by `specs/signal-forms-readiness-spec.md` §3.4.b and `docs/signal-forms.md:97-99`. | — |
| F-6 | `number-input` `roundStep` rounds to the step's decimals only: step 1, ArrowUp on 2.4 → 3 (expected 3.4); on 2.5 → 4; step `1e-7` → integer. | ⚠️ **Partly refuted.** The mechanics are right (`number-input.component.ts:233-237`; `(1e-7).toString()` is `"1e-7"`, so `decimals = 0`). But **"expected 3.4" is wrong**: native `<input type=number step=1>` `stepUp()` on 2.4 gives **3** — it snaps to the step base, it does not add-and-keep-precision. So 2.4 → 3 is accidentally correct; **2.5 → 4 is wrong under both semantics** (native: 3); step `1e-7` → integer is wrong (native: `0.5` → `0.5000001`). The component's own JSDoc (`:89`) states the *intent* — "rounding precision, avoiding float drift" — not a stepping semantic; native is the reference, and §3.4 decides snap-to-grid. Also unhandled: a non-zero `min` is not used as the step base (native min 1 step 2: 2 → 3; component: 2 → 4). | Chromium `stepUp`: step 1 `2.4`→`3`, `2.5`→`3`; `stepDown` `2.4`→`2`; step 0.1 `0.7`→`0.8`; step 1e-7 `0.5`→`0.5000001`; min 1 step 2 `2`→`3`; min −0.5 step 1 `0`→`0.5`; min 0.5 step 1 `0.5`→`1.5`; empty → `1` (`5` with min 5). |
| F-7 | `time-picker` `writeValue` → `render` echo guard `value === this.asValue()` also short-circuits a real `writeValue(null)` → type an hour, `form.reset()`, the hour stays. | ✓ **True.** `time-picker.component.ts:277-279` → `render()` → guard at `:368`. With only an hour typed, `asValue()` is `null`, so `writeValue(null)` returns before clearing. The guard is only needed for the model-effect path (`:217-220`), which is where an echo of our own `commit()` arrives; `writeValue` is never an echo. No test covers reset-after-partial. | — |
| F-8 | Check currency-input, duration-input, phone-input, rating for the same classes. | **currency-input, duration-input, phone-input: sound.** Currency has no stepping and rounds to the currency scale on blur; `writeValue` is a plain silent set (`currency-input.component.ts:236`). Duration steps whole integers per segment with wrap (`duration-input.component.ts:271-274`), state is one number so there is no partial-segment state to strand. Phone `writeValue` → `applyExternalValue('')` clears unconditionally (`phone-input.component.ts:236-258`). ⚠️ **rating: one sibling of F-2 found.** Steps are binary-exact (`0.5`/`1`), so no float drift, but keyboard steps add `precision` to whatever value is held (`rating.component.ts:293-309`): a form-written `2.3` with `precision` 0.5 → ArrowRight → **2.8**, off the half-star grid. Included as Task 9. | — |

**Corrected invariant.** The invariant as handed over was: *"A numeric
control's value is always min + k·step (k integer) within [min,max],
represented at the precision of its inputs — no float drift, no off-grid
values — and every way of setting it (default, binding, form, pointer,
keyboard, assistive tech) goes through that rule."*

⚠️ It is kept, with two clarifications Step 0 forced:

1. **"Within [min,max]" means within [min, top]**, where *top* is the largest
   grid point ≤ max. A max that is off the grid is not reachable (native range
   behaves the same way).
2. **A value written from outside is rendered on the grid but not rewritten.**
   The slider shows and steps from the snapped value, as a native range input
   does, but it does not push the snapped value back to the form or the
   `[(value)]` binding — that would be a write echoing back as a change, which
   T-10 of `signal-forms-readiness-spec.md` forbids. So: *every value the
   control renders or produces is on the grid; a programmatic off-grid value is
   displayed snapped and corrected on the next user interaction.*
3. **number-input steps on the grid but does not snap typed text.** Native
   `<input type=number>` does not rewrite a typed `2.4` with `step=1`; it flags
   `stepMismatch` for validation. Silently rewriting what a user typed is
   worse than an off-grid number. The steppers, arrow keys and wheel produce
   grid values; typing does not (out of scope, §1.4).

**Publish verdict.** Every touched file is component source under
`packages/components/ui/**`, a **new** lib file under `packages/components/lib/`,
demo/stories/e2e/docs, and regenerated `registry.json` data. All of it is
served live from `master` — **no CLI npm publish.** `npx shadcn-angular why`
shows `slider`, `number-input`, `time-picker` and `rating` have **no reverse
dependents**, and none is in the `rich-text-editor` or `data-table` closure; the
only lib addition is a new file nothing in those closures imports — **no
`release:package` for `@gilav21/shadcn-angular-rte` or `-data-table`.**

---

## 1. Product Manager section

### 1.1 Business logic

Numeric controls hold numbers on a grid defined by `min` and `step`. The
library's slider, number input and rating must produce exactly the grid
values a user expects — `0.3`, never `0.30000000000000004`; `7`, never `6`
when the grid is 1, 3, 5, 7 — no matter whether the value came from a drag, a
key, a mobile screen reader gesture, a starting default or a form.

The slider also becomes a full Angular form control: it works with
`formControlName` / `ngModel`, reports touched, and honours `form.disable()`,
exactly like the library's other inputs.

The time picker's reset bug is fixed: a form reset clears a half-typed time.

### 1.2 Why the customer wants this

- **The slider's `[defaultValue]` does nothing.** Every developer who copies
  the demo (`[defaultValue]="40"`) gets a thumb at 0. The library's own demo
  app works around it by grabbing the component with `viewChild` and calling
  `value.set(...)` (`css-settings.component.ts:163-164`).
- **Float garbage reaches their backend.** A price slider with `step=0.1` saves
  `0.30000000000000004`; a slider with `min=1 step=2` saves `6`, which their
  server-side validation rejects. The workaround is rounding every
  `(valueChange)` by hand.
- **The slider cannot sit in a reactive form.** Today the developer must bind
  `(valueChange)` and push into the `FormControl` manually, and gets no touched
  or disabled state. Every other input in the library supports
  `formControlName`.
- **Mobile screen-reader users cannot use the slider.** Their swipe gesture
  moves the native range input but the component never hears it.
- **A destroyed slider keeps listening.** Navigating away mid-drag leaves
  document listeners writing into a dead component.
- **Number input steps wrongly** from a typed value (2.5 → 4) and treats a tiny
  step like `1e-7` as integer stepping.
- **Time picker reset is broken** for half-entered times — the classic "Clear
  form" button leaves an hour behind.

### 1.3 Use cases — definition of done

| ID | Use case |
|---|---|
| **UC-1** | A developer with `step` 0.1 (or 0.05, 1e-7) on a slider presses arrow keys, Page keys, or drags, and every emitted value is the exact decimal of a grid point (`0.3`, `2.3`, `0.65`) — no float drift. |
| **UC-2** | A developer with a non-zero or fractional/negative `min` (e.g. `min=1 step=2`, `min=-0.5 step=1`, `min=0.5 step=0.1`) only ever receives values of the form `min + k·step` from pointer and keyboard, and `End` / the far end of the track gives the largest grid value ≤ `max`. |
| **UC-3** | A developer who writes an off-grid value into the slider (from a form or `[value]`) sees the thumb at the nearest grid position; the next arrow key steps from that grid position; the written value is not echoed back as a change. |
| **UC-4** | A developer sets `[defaultValue]="40"` on an uncontrolled slider and the thumb starts at 40, without the slider emitting `valueChange` or marking a form dirty. A value supplied by `[value]` or a form wins over `defaultValue`. |
| **UC-5** | A mobile screen-reader user adjusts the slider with the platform gesture and the model (and bound form) updates to the snapped value. |
| **UC-6** | A developer destroys a slider while a mouse or touch drag is in progress (or the touch is cancelled), and subsequent pointer movement changes nothing and raises no error. |
| **UC-7** | A developer binds `formControlName` (or `ngModel`) on `ui-slider`; the form's initial value renders, and each user change reaches the form exactly once. |
| **UC-8** | A developer's form marks the slider touched when the user leaves it (blur, or the end of a pointer drag). |
| **UC-9** | A developer calls `form.disable()` and the slider is disabled for pointer, keyboard and assistive tech, same as `[disabled]="true"`. |
| **UC-10** | A developer's number input steps (buttons, ArrowUp/Down, wheel) land on the grid based at `min` (or 0 when unset): an off-grid typed value steps to the next grid point in that direction (2.4 ↑ 3, 2.4 ↓ 2, 2.5 ↑ 3), an on-grid value moves one step. |
| **UC-11** | A developer's number input with a fractional or exponent-notation step (`0.1`, `1e-7`) steps without float drift and without collapsing to integer steps (`0.5` ↑ `0.5000001`). |
| **UC-12** | A developer calls `form.reset()` (or `setValue(null)`) on a time picker in which the user typed only an hour or only a minute, and every segment is cleared. |
| **UC-13** | A developer's rating with `precision` 0.5 holding a form-written `2.3` steps by keyboard to half-star values (`2.5` / `2.0`), never `2.8`. |

The spec is done when, and only when, every `UC-n` demonstrably passes.

### 1.4 Explicitly out of scope

- **Snapping typed text in `ui-number-input`.** Typing `2.4` with `step=1` stays
  `2.4` (native behaviour; see corrected invariant §0.3). A consumer wanting a
  step constraint adds a validator.
- **Rewriting a programmatically written off-grid value** back to the binding
  or form (corrected invariant §0.2).
- A range (two-thumb) slider, vertical orientation, tick marks, or `step="any"`.
- `[(value)]` re-setting the same value it already holds: if the time picker's
  bound signal is already `null` (because a partial time emitted `null`),
  setting it to `null` again is a no-op by signal equality and cannot clear
  the half-typed hour. Reactive-forms `reset()` and the Signal Forms CVA path
  both go through `writeValue` and are fixed. Recorded in the time picker's
  JSDoc, not fixed.
- The time picker's English segment labels (`SEGMENT_LABEL`) and the
  chip-list's English remove label — i18n is a separate concern.
- Replacing the demo app's `viewChild` workaround in `css-settings.component.ts`
  is optional cleanup, not required.
- currency-input, duration-input, phone-input: verified sound in §0 F-8; not
  touched.

---

## 2. QA section — write these tests FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.

Follow `.claude/CLAUDE.md` "Writing Tests": one test per behaviour, each
sampling the **input classes** listed (a table-driven `it.each` is one test),
real-shaped inputs, the lowest layer that can observe it, assertions on the
public surface (model value, emitted values, DOM attributes / the hidden range
input's `.value`, form state) — never private fields.

### 2.1 Traceability

| Test ID | Test name | Proves | Type / file |
|---|---|---|---|
| T-1 | `snaps a value to the nearest grid point of min + k·step, ties up, inside [min, top]` | UC-1, UC-2, UC-3 | unit — `lib/numeric-step.spec.ts` |
| T-2 | `steps from on-grid and off-grid values in both directions without drift` | UC-1, UC-2, UC-10, UC-11, UC-13 | unit — `lib/numeric-step.spec.ts` |
| T-3 | `counts decimals of plain and exponent-notation numbers` | UC-11 | unit — `lib/numeric-step.spec.ts` |
| T-4 | `keyboard steps land on the grid for every key` | UC-1, UC-2 | unit — `slider.component.spec.ts` |
| T-5 | `pointer position maps to a grid value` | UC-1, UC-2 | unit — `slider.component.spec.ts` |
| T-6 | `renders an off-grid written value snapped, steps from there, and does not echo it` | UC-3 | unit — `slider.component.spec.ts` |
| T-7 | `seeds from defaultValue silently, and a bound or form value wins over it` | UC-4 | unit — `slider.component.spec.ts` |
| T-8 | `a value set on the hidden range input by assistive tech commits the snapped value` | UC-5 | unit — `slider.component.spec.ts` |
| T-9 | `a drag in progress stops affecting the slider once it is destroyed or the touch is cancelled` | UC-6 | unit — `slider.component.spec.ts` |
| T-10 | `works with formControlName: renders the form value, reports each user change once, never echoes a write` | UC-7 | unit — `slider.component.spec.ts` |
| T-11 | `marks the form control touched on blur and at the end of a pointer drag` | UC-8 | unit — `slider.component.spec.ts` |
| T-12 | `form.disable() disables the range input and blocks keyboard and pointer` | UC-9 | unit — `slider.component.spec.ts` |
| T-13 | `steppers snap to the grid based at min` | UC-10, UC-11 | unit — `number-input.component.spec.ts` |
| T-14 | `form reset clears a half-typed time` | UC-12 | unit — `time-picker.component.spec.ts` |
| T-15 | `keyboard steps from an off-grid value land on the precision grid` | UC-13 | unit — `rating.component.spec.ts` |
| T-16 | `slider starts at its defaultValue and arrow keys step from it` (fix the existing harness) | UC-4, UC-1 | e2e — `e2e/harness/slider/slider.spec.ts` |
| T-17 | `ui-slider` round-trip through `[formField]` drives a user path | UC-7 | unit — `signal-forms/field-round-trip.spec.ts` (update) |

### 2.2 Input classes each test must sample

Expected values are the **native element's** results (Chromium, verified in
§0) wherever a native counterpart exists. Use exact equality (`toBe`), never
`toBeCloseTo` — exactness is the behaviour.

- **T-1 `snap(value, {min, max, step})`** —
  `{0, 100, 1}`: `2.4 → 2`, `2.5 → 3` (tie goes up);
  `{1, 10, 2}`: `5.6 → 5`, `6 → 7` (tie up), `10 → 9` (top), `-3 → 1`;
  `{-0.5, 10, 1}`: `0.2 → 0.5`, `-1 → -0.5`;
  `{0.5, 4, 0.1}`: `2.3000000000000003 → 2.3`, `4 → 4` (top on grid despite `(4-0.5)/0.1` float error);
  `{0, 2, 0.1}`: `1.15 → 1.2` (a tie that naive `1.15/0.1 = 11.499999999999998` rounds the wrong way);
  `{0, 1, 0.05}`: `0.625 → 0.65`, `0.35 → 0.35`;
  `{0, 1, 1e-7}`: `0.50000004 → 0.5`;
  invalid step (`0`, negative, `NaN`) falls back to step `1` (native default).
- **T-2 `stepFrom(value, direction, count, grid)`** — on-grid `0.2 ↑1 → 0.3`,
  `0.7 ↑1 → 0.8`; off-grid `2.4 ↑ → 3`, `2.4 ↓ → 2`, `2.5 ↑ → 3`;
  `{min 1, step 2}`: `2 ↑ → 3`; `{min -0.5, step 1}`: `0 ↑ → 0.5`;
  `{min 0.5, step 1}`: `0.5 ↑ → 1.5`; `{step 1e-7}`: `0.5 ↑ → 0.5000001`;
  count 10 (Page keys) `{min 1, max 30, step 2}`: `1 ↑10 → 21`;
  clamps at top `{1, 10, 2}`: `9 ↑ → 9`; clamps at min; unbounded side (no
  `max`) is not clamped; half-star `{0, 5, 0.5}`: `2.3 ↑ → 2.5`, `2.3 ↓ → 2`.
- **T-3 `decimalsOf`** — `1 → 0`, `0.05 → 2`, `-0.5 → 1`, `1e-7 → 7`,
  `1.5e-7 → 8`, `1e21 → 0`.
- **T-4** — `step 0.1` from `0.2`: ArrowUp → `0.3` exactly; `min 1, step 2, max
  10`: Home → `1`, End → `9`, ArrowRight ×4 from 1 → `9` then stays `9`;
  PageUp from `1` with `max 30` → `21`; RTL ArrowRight decrements on the grid
  (keep the existing RTL getComputedStyle shim pattern).
- **T-5** — track mousedown at 50 % of `{1, 10, 2}` → `5`; at the right edge →
  `9`; `{0.5, 4, 0.1}` at a position mapping to ~2.3 → exactly `2.3`; a
  touchstart sample through the same path.
- **T-6** — `writeValue(0.625)` with `{0, 1, 0.05}`: hidden input `.value` is
  `"0.65"`, the form value is still `0.625`, nothing emitted; then ArrowUp →
  `0.7` emitted once.
- **T-7** — `[defaultValue]="40"` uncontrolled → hidden input `"40"`, zero
  `valueChange` emissions; `[defaultValue]="45"` with `step 10` → `"50"`;
  `[value]="20" [defaultValue]="40"` → `"20"`; `formControl` initial `70` +
  `[defaultValue]="40"` → `"70"` and the control stays `pristine`.
- **T-8** — set the hidden input's `.value` to `"6"` with `{1, 10, 2}` and
  dispatch `input` → model `7`, form value `7`, one emission. (If jsdom
  sanitises to `7` first the result is the same — the test proves the path.)
- **T-9** — mouse: mousedown on the track, destroy the fixture, dispatch
  `mousemove` on `document` → `value()` unchanged; touch: touchstart, then
  `touchcancel`, then `touchmove` → unchanged.
- **T-10** — `FormControl(30)` → hidden input `"30"`; ArrowRight → form `31`,
  exactly one `valueChanges` emission; `control.setValue(55)` → renders `55`,
  no `(valueChange)` emission from the slider, `onChange` not re-entered
  (form `valueChanges` fires once, for the `setValue` itself).
- **T-11** — blur of the hidden input → `touched`; a mouse drag ending in
  `mouseup` → `touched`; a touch drag ending in `touchend` → `touched`;
  `focus` alone → still untouched.
- **T-12** — `control.disable()` → hidden input `disabled`, ArrowRight and a
  track mousedown leave the value unchanged; `enable()` restores.
- **T-13 (number-input, through `increment()`/`decrement()` and one real
  ArrowUp keydown on the inner `<input>`)** — the T-2 classes that apply
  (`2.4 ↑ 3`, `2.4 ↓ 2`, `2.5 ↑ 3`, `0.2 ↑ 0.3`, `min 1 step 2: 2 ↑ 3`,
  `min -0.5 step 1: 0 ↑ 0.5`, `step 1e-7: 0.5 ↑ 0.5000001`,
  `min 1 step 2 max 10: 9 ↑ 9`, `null ↑ 1`, `null ↑ 5` with `min 5`).
  Existing clamp/null tests stay green.
- **T-14** — `FormControl<string|null>(null)`: type an hour only, then
  `reset()` → every segment empty; type a minute only, then `reset()` → empty;
  type an hour only, then `setValue('09:15')` → `09`/`15` rendered. The
  existing "keeps the digit that was typed" test (the echo guard) must stay
  green.
- **T-15** — `precision 0.5`, `writeValue(2.3)`: ArrowRight → `2.5`,
  ArrowLeft (from 2.3 again) → `2`; `precision 1`, `writeValue(2.3)`:
  ArrowRight → `3`.
- **T-16** — fix the harness's degenerate `[defaultValue]="0"` (it equals the
  model default, so it could never catch F-1): use `[defaultValue]="40"`,
  assert the range input's value is `40`, press ArrowRight ×3, assert the
  displayed `(valueChange)` value is `43`. This **replaces** the existing
  e2e test rather than adding one.
- **T-17** — after Task 7 the slider provides `NG_VALUE_ACCESSOR`, so
  `FormField` binds through the CVA (see `docs/signal-forms.md:97-101`) and the
  existing `control.value.set(70)` no longer reaches the field. Replace it with
  a user path (ArrowRight keydown on the hidden input, as the `ui-rating` case
  does) and assert the field model; assert the field-to-control direction on
  the hidden input's `.value`, not `control.value()`.

### 2.3 Edge cases every test set must respect

- RTL: keyboard (T-4) and pointer (existing RTL test) mapping stays mirrored.
- Touch: T-5, T-9 and T-11 each include a touch sample.
- Disabled: T-12 for the form path; the existing `[disabled]` tests stay.
- `min ≥ max`: existing invalid-range test stays green (no snapping crash).
- `min`/`max` pushed as `undefined` by Signal Forms: existing test stays green.

### 2.4 Mutation check (required before Task 10)

Per "Writing Tests" step 6, back up and break, one at a time, then restore:
drop `min` from the snap formula; round ties down; use raw `+ step` in the
keyboard path; remove the `(input)` binding; skip the `DestroyRef` teardown;
make `writeValue` call `onChange`; restore the `asValue()` guard inside
`writeValue`; revert `decimalsOf` to `split('.')`. Each break must turn a test
red. Record the result in the Task 10 retrospective.

### 2.5 Coverage expectation

No uncovered lines in `lib/numeric-step.ts`, `slider.component.ts`, the
changed regions of `number-input.component.ts`, `time-picker.component.ts`,
`rating.component.ts`.

---

## 3. Architecture

### 3.1 Usability — the public API

No input is renamed or removed. Additions: the slider provides
`NG_VALUE_ACCESSOR`; `defaultValue` widens to `number | undefined` (default
`undefined`).

```html
<!-- simple, uncontrolled: now actually starts at 40 -->
<ui-slider [defaultValue]="40" [min]="0" [max]="100" [step]="1" ariaLabel="Volume" />

<!-- two-way, unchanged -->
<ui-slider [(value)]="volume" [step]="0.1" [min]="0" [max]="1" ariaLabel="Gain" />

<!-- reactive forms: new -->
<form [formGroup]="settings">
  <ui-slider formControlName="density" [min]="1" [max]="5" ariaLabel="Density" />
</form>

<!-- template-driven: new -->
<ui-slider [(ngModel)]="radius" [step]="0.05" [min]="0" [max]="1" ariaLabel="Radius" />

<!-- signal forms: unchanged API; now binds through the CVA -->
<ui-slider [formField]="form.volume" ariaLabel="Volume" />
```

`ui-slider` is a single-element control, so the dual-mode (content projection)
pattern does not apply (CLAUDE.md decision tree: "Progress — just needs
`[value]`").

### 3.2 Efficiency

No meaningful perf concern. Snapping is O(1) arithmetic per pointer move. The
one budget: a drag must not call `onChange` / emit for moves inside the same
grid cell — commit only when the snapped value differs from the rendered one.

### 3.3 DX for the consuming developer

- **Learn:** values are grid values; `End` may stop below an off-grid `max`.
- **Ignore:** nothing else changes for `[(value)]` users.
- **Gotcha, documented on the `value` model:** after a form `writeValue`, the
  `value` model still reads the pre-write value (the accepted limitation of the
  two-signal shape, `signal-forms-readiness-spec.md` §3.5.b) — the rendered
  value is what the hidden input shows.
- **Exported types touched:** `SliderComponent` (now `ControlValueAccessor`).
  `lib/numeric-step.ts` is internal library code but ships to consumers as a
  lib file; export its functions with JSDoc.

### 3.4 Implementation options

#### Decision A — number-input stepping semantic

**Option A1 — add-step-and-keep-precision** (2.4 ↑ 3.4).
Pros: matches the reporter's expectation. Cons: not what any native control
does; a typed off-grid value stays off-grid forever; disagrees with the slider,
which must snap.

**Option A2 — snap-to-grid, step base = `min ?? 0`** (native `stepUp`).
Pros: identical to `<input type=number>` (verified, §0 F-6), one rule shared
with the slider and rating, the arrow key always lands on a value the server
accepts. Cons: 2.4 ↑ gives 3, which a reader may find surprising — documented
in the JSDoc.

**✅ Chosen: A2.** Native is the reference, and one grid rule across three
controls is the invariant. One deliberate deviation from native, kept from the
current component: stepping from an out-of-range typed value clamps into
range (native leaves `250` unchanged on `stepUp` with `max 100`); the
component already clamps on blur and its existing tests pin that.

#### Decision B — where the grid arithmetic lives

**Option B1 — a private helper in each component.**
Pros: each component file self-contained. Cons: three copies of the subtle
part (tie rounding, float-safe floor for *top*, exponent decimals) — exactly
the code that has to be right once.

**Option B2 — a new lib file `packages/components/lib/numeric-step.ts`**
exporting `decimalsOf`, `snapToStep`, `stepFrom` (pure functions).
Pros: one tested implementation; lowest test layer (T-1…T-3 are pure unit
tests); `sync-registry --fix` adds it to the three components' `libFiles`.
Cons: one more lib file in each install.

**✅ Chosen: B2.**

Required algorithm (the tests pin the outcome; this is the shape that passes
them):

```ts
/** Digits after the point, including exponent notation: 1e-7 → 7, 1.5e-7 → 8. */
export function decimalsOf(n: number): number;

interface StepGrid { readonly min: number; readonly max?: number; readonly step: number }
```

- Invalid `step` (≤ 0 or not finite) → `1`.
- `precision = max(decimalsOf(min), decimalsOf(step))`; every result goes
  through `Number(x.toFixed(precision))`.
- Grid index `k = (v - min) / step`, first **cleaned** to 9 decimals
  (`Number(k.toFixed(9))`) so that `11.499999999999998` reads as the tie it is,
  then `Math.round` (ties up). `kTop = Math.floor(clean((max - min) / step))`.
- `stepFrom`: on-grid (`|k - round(k)| < 1e-9`) → `round(k) ± count`;
  off-grid → `ceil(k)` going up, `floor(k)` going down, then `± (count - 1)`;
  clamp `k` to `[0, kTop]` (only the bounded sides).
- Number-input base: `min ?? 0`, with no lower clamp when `min` is unset.

#### Decision C — slider state shape and the `defaultValue` seed

**Option C1 — single model, seed via `value.set()` in `ngOnInit`.**
Pros: smallest diff. Cons: the seed emits `valueChange` (a consumer's
`(valueChange)="save($event)"` saves on init); `writeValue` via the model
would also emit; no place to hold "rendered snapped value" separately from the
caller's value.

**Option C2 — `value = model<number | undefined>(undefined)`, resolved
through `defaultValue`** (the toggle-group approach).
Pros: "unset" is representable. Cons: widens `valueChange` to
`number | undefined` — a compile break for every `(valueChange)="x.set($event)"`
with a `number` signal, including the library's own dock demo.

**Option C3 — the two-signal shape of `signal-forms-readiness-spec.md` §3.5.a,
with a `linkedSignal`.**
- `private readonly current = linkedSignal(() => this.value())` — follows every
  `[value]` / `value.set()` change, and can be written locally without
  emitting.
- `readonly rendered = computed(() => snapToStep(this.current(), grid))` — the
  only value the template, `percentage`, `valueText`, keyboard and pointer read.
  Snapping in a `computed` (not inside the `linkedSignal`) means a later
  `min`/`max`/`step` change re-snaps what is held instead of re-deriving from a
  possibly stale `value()`.
- `ngOnInit`: if `defaultValue()` is defined, no `writeValue` has run, and
  `value()` is still the model's initial `0`, then `current.set(defaultValue())`
  — silent. (Component `ngOnInit` runs before `FormControlName.ngOnChanges` on
  the same element, so a form's initial value still lands after the seed and
  wins; the `written` flag makes that ordering-independent.)
- `writeValue(v)`: `written = true; current.set(v ?? resolvedMin())` — silent.
- One `commit(next)` for every user path (keyboard, pointer, `(input)`):
  `if (next === rendered()) return; current.set(next); onChange(next);
  value.set(next);` — emits exactly once.
Pros: no emission on seed or write; off-grid writes render snapped (UC-3)
without echo; no public type change. Cons: `linkedSignal` is new to this
library (stable since Angular 20 — inside the supported range); `value()` can
lag a form write (documented limitation, same as select/number-input).

**✅ Chosen: C3.** It is the only option that keeps both the no-echo contract
and the public `number` type, and it is the shape the readiness spec already
established for CVA controls.

#### Decision D — drag teardown

**Option D1 —** keep named listeners, add a `private stopDrag?: () => void`
called from `mouseup`/`touchend`/`touchcancel` and `DestroyRef.onDestroy`.
**Option D2 —** one `AbortController` per drag; every `addEventListener` gets
`{ signal }`; end-of-drag and `DestroyRef.onDestroy` call `abort()`.
Pros of D2: no remove-call bookkeeping, impossible to forget one listener.
Cons: none material (supported in every browser Angular 20 targets).

**✅ Chosen: D2.** A new drag aborts any previous one first. `mouseup` /
`touchend` also call `onTouched()` (T-11).

#### Decision E — the time picker fix

**Option E1 —** keep one `render()` and add a `force` flag for `writeValue`.
Cons: a boolean parameter that switches behaviour (Sonar S2301).
**Option E2 —** move the echo guard out of `render()` into the effect:
`effect(() => { const v = this.value(); untracked(() => { if (v !== this.asValue()) this.render(v); }); })`;
`writeValue` calls `render()` unconditionally.
**✅ Chosen: E2.** The rule: *only the model-effect path can carry an echo of
our own `commit()`; `writeValue` always renders what the form wrote.* Move the
existing explanatory comment with the guard.

#### Decision F — CVA wiring for the slider (house pattern)

Copy `number-input` / `radio-group`: `NG_VALUE_ACCESSOR` with
`forwardRef(() => SliderComponent)`, `multi: true`; `private readonly
formDisabled = signal(false)`; `readonly isDisabled = computed(() =>
this.disabled() || this.formDisabled())` replacing **every** `this.disabled()`
read in the class and template (`[disabled]` on the range input, `classes()`,
every handler guard); `registerOnChange`/`registerOnTouched`/`setDisabledState`.
`(blur)` on the hidden range input → `onTouched()`. The hidden input gets
`(input)="onNativeInput($event)"` which reads `valueAsNumber`, snaps, commits
(its `(keydown)` handler already `preventDefault`s every key it handles, so
keyboard changes never reach `(input)` twice).

### 3.5 Risks

| Risk | Mitigation |
|---|---|
| Adding `NG_VALUE_ACCESSOR` makes `FormField` bind through the CVA, silently changing how `[formField]` works for the slider. | T-17 updates the round-trip test to drive a user path; `docs/signal-forms.md:97-101` is updated to drop the slider from the "non-CVA" list. Slider's `*.types.spec.ts` (T-6 there) must stay green. |
| Rounding ties wrongly on float division (`1.15/0.1`). | T-1 samples that exact class; the algorithm cleans `k` before rounding. |
| `linkedSignal` re-derives on a `[value]` binding change and overwrites a seed. | That is the desired priority (bound value wins, UC-4); T-7 pins it. |
| A drag across one grid cell spams `onChange`. | `commit()` returns early when the snapped value equals `rendered()`. |
| `typecheck:templates` catches what `tsc` does not. | Run `npm run typecheck:templates` in every task that touches a template or a public type. |
| Number-input behaviour change (2.5 ↑ now 3) surprises a consumer. | Not breaking API; JSDoc on `step` states the native semantic. Existing tests that assumed integer steps stay green. |
| Demo/stories keep a workaround that now double-sets. | Task 10 updates the slider demo, dock demo, icon demo and stories to rely on `defaultValue`. |

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

Run per task: `npx vitest --run <touched folders> packages/components/signal-forms`,
`npm run typecheck`, `npm run typecheck:templates`, `npm run lint`. After any
new file: `npx tsx packages/cli/scripts/sync-registry.ts --fix` (never hand-edit
`registry.json`).

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-15 and T-17 (T-16 is written in Task 10 with the harness change). Each must fail for the reason in §0, not for a missing import — stub `lib/numeric-step.ts` with signatures that throw. | all | ⬜ Not started | — | — | — |
| 2 | Implement `packages/components/lib/numeric-step.ts` (`decimalsOf`, `snapToStep`, `stepFrom`) per Decision B; JSDoc on each export. Invariant: *every result is `min + k·step` at `max(decimalsOf(min), decimalsOf(step))` decimals, ties up, `k ∈ [0, kTop]` on the bounded sides.* | UC-1, UC-2, UC-11 (T-1…T-3) | ⬜ Not started | — | — | — |
| 3 | Slider grid: introduce `current` (`linkedSignal`) + `rendered` (`computed`, snapped) + `commit()`; route keyboard (`onKeyDown`) and pointer (`updateValueFromPosition`) through `stepFrom`/`snapToStep`; template, `percentage`, `valueText` read `rendered()`. Invariant: *every value the slider renders or produces is on the grid.* | UC-1, UC-2, UC-3 (T-4, T-5, T-6) | ⬜ Not started | — | — | — |
| 4 | Slider `defaultValue`: widen to `input<number \| undefined>(undefined)`, delete the constructor read, seed silently in `ngOnInit` per Decision C3; fix the JSDoc at `:47`. Invariant: *the seed applies only when nothing else supplied a value, and never emits.* | UC-4 (T-7) | ⬜ Not started | — | — | — |
| 5 | Slider events: `(input)` on the hidden range input → snap + `commit()`; drag listeners via one `AbortController` per drag, aborted on `mouseup`/`touchend`/`touchcancel` and `DestroyRef.onDestroy`. Invariant: *every native value change goes through the grid rule, and no listener outlives its drag or its component.* | UC-5, UC-6 (T-8, T-9) | ⬜ Not started | — | — | — |
| 6 | Slider CVA per Decision F: `NG_VALUE_ACCESSOR`, `writeValue` (silent, sets `written`), `registerOnChange`, `registerOnTouched` (blur + drag end), `setDisabledState` + `isDisabled` everywhere `disabled()` was read. Update the `value` model JSDoc with the write-lag limitation. | UC-7, UC-8, UC-9 (T-10, T-11, T-12) | ⬜ Not started | — | — | — |
| 7 | Signal Forms follow-through: update `field-round-trip.spec.ts` `ui-slider` case (T-17); update `docs/signal-forms.md:97-101` to drop `ui-slider` from the non-CVA list; confirm `signal-forms/slider.types.spec.ts` and `angular20-safety.spec.ts` stay green. | UC-7 (T-17) | ⬜ Not started | — | — | — |
| 8 | Number-input: replace `roundStep` with `stepFrom` (base `min ?? 0`) in `increment`/`decrement`; delete `roundStep`; rewrite the `step` JSDoc (`:89`) to state the native snap-to-grid semantic. Invariant: *a step from any value lands on the next grid point in that direction.* | UC-10, UC-11 (T-13) | ⬜ Not started | — | — | — |
| 9 | Time picker: move the echo guard from `render()` into the model effect per Decision E2; `writeValue` renders unconditionally; record the `[(value)]`-same-value limitation (§1.4) in the `writeValue` JSDoc. Rating: route `onKeydown` arrow/Page steps through `stepFrom` with grid `{min 0, max resolvedMax(), step precision()}`. | UC-12, UC-13 (T-14, T-15) | ⬜ Not started | — | — | — |
| 10 | Consumer surfaces + bundle close: fix the e2e harness (T-16) and its stale "NOT ControlValueAccessor" comment; update `slider.stories.ts` (add a reactive-forms story and a fractional-step story); slider demo page gains a copy-paste reactive-forms example; check the dock and icon demos now start at their `defaultValue`. Run the §2.4 mutation check. Run `npm run docs:regen` (then restore `documentation.json` per project memory), `npm run e2e -- slider`, `npm run e2e -- number-input`, `npm run e2e -- time-picker`, `npm run e2e -- rating`, `npm run test-visual` (full browser suite, zero failures), then `npm run sonar:gate` and verify the four gate conditions in CLAUDE.md §4. Screenshot the slider demo at 320px and 1024px in LTR and RTL. | all (T-16) | ⬜ Not started | — | — | — |

---

## 6. Completion log

| Task | Completed | Score | Reviewer rationale (compressed) |
|---|---|---|---|
| — | — | — | — |
