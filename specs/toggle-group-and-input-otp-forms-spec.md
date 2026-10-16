# Toggle Group, Input OTP & Chip List — Forms and Keyboard Correctness — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **Shared-file note (not a prerequisite):** `slider-and-numeric-input-correctness-spec.md`
> also edits `packages/components/signal-forms/field-round-trip.spec.ts` and
> `docs/signal-forms.md` (the same "CVA wins over the model" paragraph at
> `:97-101`). The two specs can run in parallel; whichever merges second
> resolves a small textual conflict in those two files. Nothing else overlaps.

**Status:** not started
**Owner:** unassigned
**Source:** codebase review findings, 2026-10-03 (toggle-group / input-otp / chip-list)

---

## 0. Step 0 — findings re-verified against the source (2026-10-03)

Each finding was checked against the source and its spec file. Claims about
native browser behaviour were run in Playwright Chromium on a raw-HTML replica
of the component's markup and handlers — **not** on the component itself; each
task re-verifies on the real component in the browser test leg. Corrections are
marked ⚠️ and keep the original claim.

| # | Finding as reported | Verdict | Evidence |
|---|---|---|---|
| F-1 | `toggle-group` has no ControlValueAccessor (no `formControlName`/`ngModel`, no touched/disabled). | ✓ **True.** `toggle-group.component.ts:58-66` provides only `TOGGLE_GROUP`. It has a `disabled` input (`:74`) and a `value` model (`:98`) for Signal Forms, nothing for reactive/template forms. | `specs/signal-forms-readiness-spec.md` §3.4.b; `docs/signal-forms.md:97-99`. |
| F-2 | `input-otp` has no ControlValueAccessor and no `disabled` input. | ✓ **True.** `input-otp.component.ts:68-169`: inputs are `class`, `ariaLabel`, `ariaLabelledby`, `maxLength`, `separator`, `value`. `containerClasses` already carries `has-[:disabled]:opacity-50` (`:98`) that nothing can trigger. The e2e harness says so in a comment (`e2e/harness/input-otp/input-otp-demo.component.ts:9-12`: "`[ngModel]` would no-op"). | — |
| F-3 | Left/Right move only the visual highlight while typing always appends at the end. | ✓ **True.** `onKeydown` (`:133-139`) changes `focusedIndex` and `preventDefault`s, so the hidden input's real caret never moves; `onInput` (`:123-129`) reads the whole `input.value`, so the character lands at the end. The existing test `should navigation with arrows` (`input-otp.component.spec.ts:66`) asserts only `focusedIndex()` and never types — it pins the half that looks right. | — |
| F-4 | Arrows not mirrored in RTL. | ⚠️ **Mis-framed.** The deeper defect is the **layout**: the slot row is a plain `flex` row, so in an RTL page slot 0 sits **rightmost** (raw-flex probe: `dir=rtl` children at x = 300, 292, 284). A code `123` therefore reads `3 2 1` left-to-right, while the same digits typed into any RTL text field render `123` (a digit run is LTR under the bidi algorithm). Mirroring the arrows would entrench the reversed row. Fix: pin the slot row `dir="ltr"` — the same decision `ui-time-picker` made and documents ("no locale reads a clock right-to-left") — after which physical arrows are correct in both directions. Needs a screenshot of the real component in RTL (Task 4). | Chromium raw-HTML probe; `time-picker.component.ts:104-114`. |
| F-5 | 7 tab stops for 6 digits. | ✓ **True.** Each slot is `tabindex="0" role="button"` (`:26-35`) plus the focusable sr-only `<input>` (`:49-62`) = 7. A slot "button" also activates only on Enter (`(keydown.enter)`), not Space, so it fails the button keyboard contract as well. | — |
| F-6 | Hard-coded English labels. | ✓ **True.** `'Digit ' + (idx + 1)` (`:34`). The repo pattern is a per-component `*.locales.ts` + `createLocaleBindings` from `lib/i18n` (reference: `rating/rating.locales.ts`, `rating.component.ts:15-16,73-81`). ⚠️ Once the slots stop being focusable (F-5) they become `aria-hidden` and "Digit n" disappears; the remaining English-only gap is that the hidden input has **no default accessible name** when the consumer passes neither `ariaLabel` nor `ariaLabelledby`. That is what gets a locale file. | — |
| F-7 | With a full code nothing is highlighted on focus. | ✓ **True.** `onFocus` sets `focusedIndex = value.length` = 6 (`:156-158`); there is no slot 6. (`onInput` uses `min(length, slotCount-1)` — the two disagree.) | — |
| F-8 | Paste behaviour should be verified. | ✓ **Two defects found.** (a) The hidden input has `maxlength` = slot count, so pasting a fresh code into a **full** field inserts nothing — Chromium: `maxlength=6 value=123456`, caret at end, insert `654321` → stays `123456`. (b) Pasting a full code into a **partly** filled field appends and truncates — `123` + paste `456789` → `123456`, a code that is neither. OTP users paste whole codes; the paste must replace. | Chromium raw-HTML probe (`Input.insertText`). |
| F-9 | Chip-list: Enter not guarded with `event.isComposing`. | ✓ **True.** `chip-list.component.ts:157-166`: Enter (and every `separatorKeys` key) commits with no composition check. A CJK/Korean IME user pressing Enter to confirm a candidate gets a chip of the half-composed text. No `isComposing` guard exists anywhere in `packages/components`. | — |
| F-10 | Chip-list: `track chip` + `allowDuplicates` → duplicate track keys (NG0955). | ✓ **True.** `chip-list.component.html:22` tracks by the chip string; `allowDuplicates` (`chip-list.component.ts:89`) explicitly permits equal strings. | — |
| F-11 | Chip-list: `(keydown.space)="focusInput()"` on the fieldset may steal Space from a chip's remove button — needs browser verification. | ✓ **Confirmed on a raw-HTML replica in Chromium, and worse than suspected: Enter is stolen too.** A `<fieldset>` whose `keydown` handler (Space or Enter) focuses the inner `<input>` stops a focused child `<button>` from clicking: Space → no click, Enter → no click. The remove button (`chip-list.component.html:33-39`) is therefore unusable from the keyboard. Re-verify on the real component in Task 8 (browser leg). | Chromium raw-HTML probe. |

**Chip-list placement.** Kept **in this spec** (Task 8), not split out: three
small fixes in one folder are below the bundling floor for a spec of their own
(`plan-to-specs` Step 1: "< ~3 tasks — merge into a neighbour"), they share
this spec's theme (keyboard and forms correctness of an input control), and
they touch no file the other two components touch.

**Publish verdict.** All touched files are component source under
`packages/components/ui/**`, one **new** component file
(`input-otp/input-otp.locales.ts`), stories, demo, e2e harnesses, docs, and
regenerated `registry.json` data — all served live from `master`: **no CLI npm
publish.** `npx shadcn-angular why` shows `toggle-group` and `input-otp` have
no reverse dependents and `chip-list`'s only one is `kanban`; none is in the
`rich-text-editor` or `data-table` closure, and no file under
`packages/components/lib/` is edited (input-otp only starts *importing* the
existing `lib/i18n`, which `sync-registry --fix` adds to its `libFiles`) — **no
`release:package` for either compiled package.**

---

## 1. Product Manager section

### 1.1 Business logic

`ui-toggle-group` and `ui-input-otp` become full Angular form controls like the
rest of the library's inputs: they work with `formControlName` and `ngModel`,
report touched, and honour `form.disable()`. Input OTP also gains a `disabled`
input.

Input OTP's keyboard model is made honest: the highlighted slot is always
where the next character goes, the field is a single tab stop, the digit order
is the same in RTL pages as in LTR pages, pasting a code replaces the code, and
the field has a translated accessible name by default.

Chip list stops creating chips from half-composed IME text, renders duplicate
chips without a framework error, and its remove buttons work from the keyboard.

### 1.2 Why the customer wants this

- **No reactive forms.** A developer building a login-with-OTP or a settings
  form today must bind `(valueChange)` and push into the `FormControl` by hand,
  and gets no touched/disabled — so their "show error when touched" logic and
  `form.disable()` during submit silently skip these two controls.
- **Input OTP cannot be disabled** — not even with an input. During a "verifying
  code…" request the user can keep typing.
- **Correcting one digit is impossible.** The user sees slot 2 highlighted,
  types, and the digit lands at the end. The only workaround is Backspace to
  the mistake and retype everything after it.
- **Paste is broken.** The standard OTP flow is "copy code from SMS/email,
  paste". With a full field nothing happens; with a partial field the result is
  a mix of two codes.
- **RTL apps show codes backwards.** A Hebrew/Arabic app renders `123456` as
  `654321` reading left to right.
- **Seven tab stops** for one field, each announced as an English "Digit n"
  button that does nothing on Space.
- **Chip list**: CJK users get garbage chips; keyboard users cannot remove a
  chip; `allowDuplicates` logs a framework error.

### 1.3 Use cases — definition of done

| ID | Use case |
|---|---|
| **UC-1** | A developer binds `formControlName` (or `ngModel`) on `ui-toggle-group` in `single` and in `multiple` mode; the form's initial value renders as pressed items, each user toggle reaches the form exactly once, and a form write (including `null`) changes the pressed items without emitting. |
| **UC-2** | A developer's form marks the toggle group touched when focus leaves the group, not when focus moves between its items. |
| **UC-3** | A developer calls `form.disable()` and every toggle-group item is disabled and inert, same as `[disabled]="true"`. |
| **UC-4** | A developer binds `formControlName` (or `ngModel`) on `ui-input-otp`; the initial value renders in the slots, typing reaches the form once per change, a form write (including `null`) renders without emitting, and blur marks it touched. |
| **UC-5** | A developer sets `[disabled]="true"` or calls `form.disable()` on `ui-input-otp`, and the user can neither focus nor type into it, and it looks disabled. |
| **UC-6** | A user moves to a slot (arrow keys or a click/tap on the slot) and types; the character replaces the one in that slot (or fills it when empty), and the highlight moves to the next slot. |
| **UC-7** | A user in an RTL page sees the code in the same left-to-right order as in an LTR page, and Left/Right move the highlight left/right on screen. |
| **UC-8** | A keyboard user reaches the whole OTP field with one Tab and leaves it with the next Tab. |
| **UC-9** | A user focuses an OTP field that already holds a full code and the last slot is highlighted; typing replaces that last character. |
| **UC-10** | A user pastes a code (with or without spaces/dashes) into an empty, partly filled, or full OTP field, and the field holds exactly the pasted code (sanitised, upper-cased, truncated to the slot count). |
| **UC-11** | A screen-reader user hears a translated name for the OTP field when the developer supplied no label; a developer-supplied `ariaLabel`/`ariaLabelledby` still wins. |
| **UC-12** | An IME user (Chinese/Japanese/Korean) presses Enter or a separator key to confirm a composition in `ui-chip-list`, and no chip is created until the composition is finished. |
| **UC-13** | A developer with `allowDuplicates` adds or writes equal chips, and the list renders them all, removes the right one, and logs no framework error. |
| **UC-14** | A keyboard user focuses a chip's remove button and presses Enter or Space, and that chip is removed. |

The spec is done when, and only when, every `UC-n` demonstrably passes.

### 1.4 Explicitly out of scope

- Roving-tabindex / arrow-key navigation **between toggle-group items** (WAI-ARIA
  toolbar pattern). Today every item is a tab stop; that is a separate a11y
  improvement.
- An OTP "mask" (password-style dots), a `pattern` input (digits-only vs.
  alphanumeric), or auto-submit on completion.
- Toggle group's `''`-when-cleared emission in single mode (`toggle-group.component.ts:162`)
  is kept as the form value too — changing it to `null` would be a separate
  breaking change.
- Chip-list's English `'Remove ' + chip` label and the time-picker's English
  segment labels — i18n of other components.
- A general `isComposing` audit of every keyboard handler in the library. This
  spec fixes chip-list (the reported case) and records the class; a follow-up
  audit is suggested in the Task 8 retrospective.

---

## 2. QA section — write these tests FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.

Follow `.claude/CLAUDE.md` "Writing Tests": one test per behaviour sampling the
input classes listed (table-driven where it helps), real-shaped inputs, the
lowest layer that can observe it, assertions on the public surface (form
state, emitted values, DOM: `aria-pressed`, `disabled`, the hidden input's
`.value`, a slot's `data-active`, rendered geometry) — never private fields.

**Layer choice.** Selection-based typing, Tab order, paste and button
activation depend on **native text editing and key activation**, which jsdom
does not perform and synthetic events do not trigger. Those tests live in the
**browser leg** (`*.component.browser.spec.ts`, real keys via
`userEvent` from `vitest/browser`, as `select.component.browser.spec.ts` does).
Everything else is a jsdom unit test.

### 2.1 Traceability

| Test ID | Test name | Proves | Type / file |
|---|---|---|---|
| T-1 | `works with formControlName in single and multiple mode: renders, reports each toggle once, never echoes a write` | UC-1 | unit — `toggle-group.component.spec.ts` |
| T-2 | `marks touched only when focus leaves the group` | UC-2 | unit — `toggle-group.component.spec.ts` |
| T-3 | `form.disable() disables every item and blocks toggling` | UC-3 | unit — `toggle-group.component.spec.ts` |
| T-4 | `works with formControlName: renders, reports each edit once, never echoes a write, touched on blur` | UC-4 | unit — `input-otp.component.spec.ts` |
| T-5 | `disabled input and form.disable() make the field unfocusable and inert` | UC-5 | unit — `input-otp.component.spec.ts` |
| T-6 | `typing lands in the highlighted slot after arrows and after a slot click` | UC-6 | browser — `input-otp.component.browser.spec.ts` |
| T-7 | `renders slot 0 leftmost and maps arrows physically in an RTL page` | UC-7 | browser — `input-otp.component.browser.spec.ts` |
| T-8 | `is a single tab stop` | UC-8 | browser — `input-otp.component.browser.spec.ts` |
| T-9 | `focusing a full code highlights the last slot and typing replaces it` | UC-9 | browser — `input-otp.component.browser.spec.ts` |
| T-10 | `a paste replaces the code in empty, partial and full fields` | UC-10 | browser — `input-otp.component.browser.spec.ts` |
| T-11 | `names the field from the locale unless the consumer labels it` | UC-11 | unit — `input-otp.component.spec.ts` |
| T-12 | `does not commit a chip while an IME composition is active` | UC-12 | unit — `chip-list.component.spec.ts` |
| T-13 | `renders and removes duplicate chips without a duplicate-key error` | UC-13 | unit — `chip-list.component.spec.ts` |
| T-14 | `Enter and Space on a remove button remove that chip` | UC-14 | browser — `chip-list.component.browser.spec.ts` |
| T-15 | `ui-toggle-group` and `ui-input-otp` round-trip through `[formField]` via user paths | UC-1, UC-4 | unit — `signal-forms/field-round-trip.spec.ts` (update) |
| T-16 | e2e harness: OTP paste-replaces journey | UC-10 | e2e — `e2e/harness/input-otp/input-otp.spec.ts` |

### 2.2 Input classes each test must sample

- **T-1** — `single`: `FormControl('bold')` → only "bold" `aria-pressed="true"`;
  click "italic" → form `'italic'`, `valueChanges` fired once; click "italic"
  again → `''`; `setValue('underline')` → pressed updates, the group emits no
  `(valueChange)`; `setValue(null)` → nothing pressed. `multiple`:
  `FormControl(['a','b'])` → both pressed; click "c" → `['a','b','c']`;
  click "a" → `['b','c']`; `setValue(null)` → nothing pressed.
  `[defaultValue]="'bold'"` + `FormControl('italic')` → "italic" pressed (form wins).
- **T-2** — focus item 1, move focus to item 2 (`focusout` with `relatedTarget`
  inside) → untouched; move focus to a button outside → touched.
- **T-3** — `control.disable()` → every item `<button>` `disabled`, a click
  leaves the form value unchanged; `enable()` restores; the data-driven
  (`items`) mode samples the same.
- **T-4** — `FormControl('AB12')` → slots show `A`,`B`,`1`,`2`; an `input`
  event with the hidden input's value set → form value updated once;
  `setValue('9Z')` → slots show `9`,`Z`, no `(valueChange)`; `setValue(null)` →
  empty slots; blur of the hidden input → touched. A form write is rendered
  as-is (no sanitising) — the sanitiser filters user input only, the same rule
  as `number-input`/`currency-input`'s `writeValue`.
- **T-5** — `[disabled]="true"`: hidden input `disabled`, slot click does not
  focus it; `form.disable()`: same; `enable()` restores.
- **T-6** — `123` typed, ArrowLeft ×2, type `9` → `193`; `123456` then click
  slot 2, type `9` → `129456`; `12` then click slot 5 (past the end) → the
  caret clamps to slot 2 and typing `3` → `123`. Assert the hidden input's
  value **and** which slot carries `data-active`.
- **T-7** — host `dir="rtl"`: slot 0's `getBoundingClientRect().left` <
  slot 1's; `123` renders `1`,`2`,`3` left to right; ArrowLeft moves
  `data-active` to the slot on the left. Also take one screenshot for the
  retrospective (`docs:` not required).
- **T-8** — a button before and after the field: Tab from the first lands on
  the OTP's input; the next Tab lands on the second button. Slots carry no
  `tabindex` and are `aria-hidden="true"`.
- **T-9** — value `123456`, focus → the 6th slot carries `data-active`; type
  `7` → `123457`.
- **T-10** — dispatch a real `ClipboardEvent('paste')` with a `DataTransfer`
  holding: `987654` into empty → `987654`; `987654` into `123` → `987654`;
  `987654` into `123456` → `987654`; `ab-12 34` → `AB1234`; `12345678` → `123456`.
  Each yields exactly one `(valueChange)`.
- **T-11** — no labels, `UI_LOCALE_ID` `en` → hidden input
  `aria-label="One-time code"`; `he` → the Hebrew string; `[ariaLabel]="'PIN'"`
  → `PIN`; `[ariaLabelledby]` set → no `aria-label` attribute.
- **T-12** — synthetic `KeyboardEvent('keydown', { key: 'Enter', isComposing: true })`
  on the inner input with draft `中` → no chip, draft intact; the Safari shape
  (`isComposing: false`, `keyCode: 229`) → no chip; a separator key (`,` in
  `separatorKeys`) during composition → no chip; a plain Enter afterwards →
  one chip `中`.
- **T-13** — `allowDuplicates`, `writeValue(['a','a','b'])` → three
  `[data-slot="chip"]`; remove the **second** `a` via its remove button → chips
  `['a','b']`; `console.warn`/`console.error` not called with `NG0955`.
- **T-14** — chips `['a','b','c']`: `userEvent` focus the remove button of
  `b`, press Enter → `['a','c']`; focus the remove button of `c`, press Space
  → `['a']`; clicking the empty area of the container still focuses the inner
  input (the existing behaviour must survive).
- **T-15** — after the CVA lands, `FormField` binds through it (see
  `docs/signal-forms.md:97-101`): replace `control.value.set('XYZ')` in the
  `ui-input-otp` case with a user path (an `input` event on the hidden input)
  and assert field→control on the slots' text; the `ui-toggle-group` case
  already drives `toggle()` — it must stay green once `toggle()` calls
  `onChange`.
- **T-16** — extend the existing harness spec: after typing `123456`, paste
  `654321` (Playwright `page.evaluate` dispatching a `ClipboardEvent` with
  `DataTransfer`, or the clipboard API with granted permissions) → displayed
  value `654321`. Update the harness's stale "`[ngModel]` would no-op" comment.

### 2.3 Edge cases

- RTL: T-7 (OTP); toggle-group joins are already covered by its browser spec.
- Touch: slot tap = click (T-6 click sample covers it); no hover-only UI added.
- Empty/null: T-1, T-4 `setValue(null)`.
- `maxLength` pushed as `undefined` by Signal Forms: existing
  `signal-forms/input-otp.types.spec.ts` must stay green.
- Disabled set before first render (`[disabled]="true"` initially) and after
  (T-5, T-3).

### 2.4 Mutation check (required before Task 9)

Break, one at a time, then restore: drop the `onChange` call from toggle-group's
commit; make toggle-group's `writeValue` emit; remove `dir="ltr"` from the slot
row; restore `tabindex="0"` on slots; restore the `maxlength`-only paste path;
make `onFocus` use `value.length` again; remove the `isComposing` guard; restore
`track chip`; remove the `target === currentTarget` guard. Each must turn a
test red. Record in the Task 9 retrospective.

### 2.5 Coverage expectation

No uncovered lines in `toggle-group.component.ts`,
`sub/toggle-group-item.component.ts`, `input-otp.component.ts`,
`input-otp.locales.ts`, and the changed regions of `chip-list.component.ts`.

---

## 3. Architecture

### 3.1 Usability — the public API

Additions only: both components provide `NG_VALUE_ACCESSOR`; `ui-input-otp`
gains `disabled = input(false)` and `locale = input<LocaleInput<InputOtpLocale>>()`.
`ui-input-otp-slot`/`-group`/`-separator` are unchanged (declarative only).

```html
<!-- toggle group: simple mode + reactive forms -->
<ui-toggle-group type="multiple" formControlName="styles"
  [items]="[{ value: 'bold', label: 'Bold' }, { value: 'italic', label: 'Italic' }]" />

<!-- toggle group: custom mode (projection) + ngModel -->
<ui-toggle-group type="single" [(ngModel)]="align">
  <ui-toggle-group-item value="left" ariaLabel="Align left"><svg>…</svg></ui-toggle-group-item>
  <ui-toggle-group-item value="center" ariaLabel="Align center"><svg>…</svg></ui-toggle-group-item>
</ui-toggle-group>

<!-- input OTP: reactive forms + disable while verifying -->
<ui-input-otp formControlName="code" [maxLength]="6" />
<!-- this.form.controls.code.disable() while the request is in flight -->

<!-- input OTP: plain input binding -->
<ui-input-otp [(value)]="code" [disabled]="verifying()" ariaLabel="Verification code" />
```

Toggle group already implements the dual-mode pattern (`items` vs. projected
items) and keeps it; input OTP's slots are rendered from its own state with
the shadcn markup accepted for parity — unchanged.

### 3.2 Efficiency

No meaningful perf concern: at most a handful of items/slots, O(1) work per
keystroke.

### 3.3 DX for the consuming developer

- **Learn:** both now work with `formControlName`/`ngModel`; input OTP has
  `disabled`; pasting replaces the code; OTP slots are presentational
  (`aria-hidden`), so tests should target the hidden `<input>`.
- **Form value shapes:** toggle group `single` → `string` (`''` when cleared),
  `multiple` → `string[]`; input OTP → `string`. `null` written by a form clears.
- **Gotcha, documented on each `value` model:** after a form `writeValue`, the
  `value` model may still read the pre-write value (toggle group's two-signal
  shape) — read `selection()` / the DOM for what is rendered.
- **Exported types touched:** `ToggleGroupComponent`, `InputOTPComponent`
  (both now `ControlValueAccessor`), new `InputOtpLocale` + `INPUT_OTP_LOCALES`
  from `input-otp/input-otp.locales.ts`, re-exported from the barrel
  `input-otp/index.ts` exactly as `rating/index.ts` re-exports `rating.locales`.

### 3.4 Implementation options

#### Decision A — CVA state shape

**Option A1 — one shape for both: two signals (internal + model), as in
`select`.** Pros: uniform. Cons: input OTP has no internal signal today; adding
one means every handler and the template change read sites for no behavioural
gain.

**Option A2 — follow each component's existing shape.** Toggle group already
has the two-signal shape (`selection` + `value`, `toggle-group.component.ts:98-115`)
with a documented "a write from outside stays silent" contract →
`writeValue(v)` sets `selection` only; a single `commit(next: string[])` does
`selection.set` + `onChange(shape(next))` + `value.set(shape(next))`, and
`toggle()` calls it. Input OTP is single-model (`value = model('')`) and never
promised silence → follow `signal-forms-readiness-spec.md` §3.5.b:
`writeValue(v)` → `value.set(v ?? '')` (equality suppresses a same-value echo);
user edits go through one `commit(next)` = `onChange(next)` + `value.set(next)`.
Pros: no behaviour change for existing `[(value)]` users; each precedent is
already pinned in `signal-forms/single-signal-emission.spec.ts` or the readiness
spec. Cons: the two controls differ in whether a form write reaches
`(valueChange)` — documented on each `value` model.

**✅ Chosen: A2.** House CVA pattern for both (copy `radio-group` /
`number-input`): `NG_VALUE_ACCESSOR` with `forwardRef`, `multi: true`;
`private readonly formDisabled = signal(false)`; `readonly isDisabled =
computed(() => this.disabled() || this.formDisabled())`, replacing every
`disabled()` read — including `ToggleGroupItemComponent`'s template
(`[disabled]="group?.disabled() || disabled()"` → `group?.isDisabled()`) and
`toggle()`'s guard. Touched: toggle group on `(focusout)` of the fieldset when
`relatedTarget` is outside it (the `time-picker` `onFocusOut` shape); input
OTP on `(blur)` of the hidden input.

#### Decision B — OTP insertion model

**Option B1 — keep the virtual caret (`focusedIndex`) and splice typed
characters in by hand** using `InputEvent.data`/`inputType`.
Pros: small diff. Cons: re-implements text editing — breaks on IME, autofill
(`autocomplete="one-time-code"` sets the whole value), dictation, and
`insertReplacementText`; each is a separate bug class.

**Option B2 — the hidden input's real selection *is* the caret.** On focus,
arrow keys and slot click, set `setSelectionRange(i, i + 1)` when slot `i`
holds a character (so typing *replaces* it — native overwrite via selection),
or a collapsed caret at `i` when it is the first empty slot. `onInput` keeps
reading the whole sanitised value (native editing already did the right
thing) and then places the selection on the next slot. The highlight is
derived from the selection (`data-active` on slot `min(selectionStart,
slotCount - 1)`). Backspace is left to the native input (deletes the selected
or preceding character); the custom Backspace branch is deleted.
Pros: native editing for every input method; the highlight cannot disagree
with where text goes; this is how widely used OTP inputs work. Cons: needs
browser-leg tests (accepted, §2 layer choice).

**✅ Chosen: B2.** Invariant: *the highlighted slot is always where the next
character lands.* Arrows: `preventDefault`, move one slot, clamp to
`[0, min(value.length, slotCount - 1)]` so no gap can be created. Focus with a
full code → last slot selected (UC-9).

#### Decision C — RTL

**Option C1 — follow `dir`, mirror arrows.** Cons: shows `123` as `3 2 1`
(§0 F-4).
**Option C2 — pin the slot row `dir="ltr"`, physical arrows.** A code is a
digit/Latin run, LTR under bidi in every script; `ui-time-picker` made the same
call. The `ltr:`/`rtl:` corner/border variants in `slotClasses`
(`input-otp.component.ts:104-107`) become dead and are replaced by plain
physical `rounded-l-md`/`rounded-r-md`/`border-l`.
**✅ Chosen: C2.**

#### Decision D — tab stops and slot semantics

**Option D1 — keep slots as buttons, add Space activation, make them
`tabindex="-1"`.** Cons: buttons that are not in the tab order and only move a
caret are noise for a screen reader.
**Option D2 — slots become presentational**: no `tabindex`, no `role`,
`aria-hidden="true"`; `(click)` (pointer and tap) focuses the input and
selects the slot. The hidden input is the only focusable element, and its
value is what assistive tech reads.
**✅ Chosen: D2.** Removes the "Digit n" English strings outright.

#### Decision E — paste

**Option E1 — remove `maxlength` and truncate in `onInput`.** Cons: the
partial-field case still appends (`123` + `456789` → `123456`).
**Option E2 — explicit `(paste)` handler**: `preventDefault`, read
`clipboardData.getData('text')`, sanitise with the existing rule (alphanumeric,
upper-case, slice to `slotCount()`), and if non-empty `commit()` it as the whole
value, then select the slot after its end. `maxlength` stays (it still stops a
keyboard insertion past the end).
**✅ Chosen: E2.** Invariant: *a paste replaces the code.* Extract the
sanitiser into one private function used by `onInput` and `onPaste`.

#### Decision F — default accessible name

Follow the rating precedent: new `input-otp/input-otp.locales.ts`
(`InputOtpLocale extends LocaleMeta { label: string }`,
`INPUT_OTP_LOCALES`), `locale` input, `createLocaleBindings(this.locale,
INPUT_OTP_LOCALES)`. `aria-label` = `ariaLabel() ?? (ariaLabelledby() ? null :
t().label)`. Ship the same ten locales rating ships:
`en` "One-time code", `he` "קוד חד-פעמי", `ar` "رمز لمرة واحدة",
`de` "Einmalcode", `fr` "Code à usage unique", `es` "Código de un solo uso",
`ja` "ワンタイムコード", `zh` "一次性验证码", `ru` "Одноразовый код",
`pt` "Código de uso único" (`he`/`ar` with `rtl: true`).
The alternative — no default, require the consumer to label it — was ruled
out: the field is unnamed today in every demo that omits `ariaLabel`, and the
library's other composite controls (rating, time-picker) ship a default.

#### Decision G — chip-list fixes

- **IME:** guard at the top of `onKeyDown`:
  `if (event.isComposing || event.keyCode === 229) return;`. The `keyCode`
  half is Safari, which fires the confirming keydown *after*
  `compositionend` with `isComposing: false`. Alternative considered:
  tracking `compositionstart`/`compositionend` in a flag — ruled out because
  Safari's ordering makes the flag already cleared when the keydown arrives.
  If SonarQube flags the deprecated `keyCode` (S1874), that is a deliberate,
  documented cross-browser use: record it in
  `docs/sonarqube-accepted-findings.md` with this rationale and exclude via
  `sonar-project.properties` — never an inline disable.
- **Duplicates:** `track $index`. Chips are stateless badges, so index identity
  is correct; with `allowDuplicates` there is no other unique key.
- **Stolen keys:** the fieldset's `(keydown.enter)`/`(keydown.space)` stay
  (they satisfy Sonar's "mouse events need key events" rule for the
  `(click)`), but `focusInput` is only called when
  `event.target === event.currentTarget` — the key was aimed at the container
  itself, not a child. Invariant: *a key pressed on a child control is that
  control's; the container only redirects keys aimed at itself.* Add a
  `focusFromContainer(event: Event)` method for the template rather than
  changing `focusInput()`'s public signature.

### 3.5 Risks

| Risk | Mitigation |
|---|---|
| Adding `NG_VALUE_ACCESSOR` switches `[formField]` to the CVA path. | T-15 updates the round-trip cases; `docs/signal-forms.md:97-101` loses both from the non-CVA list; `signal-forms/*.types.spec.ts` for both stay green. |
| `setSelectionRange` on a `type="text" inputmode="numeric"` input — fine; on `type="number"` it would throw. | The input stays `type="text"`; T-6 runs in a real browser. |
| Mobile keyboards ignore a 1-character selection and insert anyway. | `onInput` always re-derives from the full sanitised value and truncates to `slotCount()`; worst case equals today's append behaviour. Note the device you checked in the Task 4 retrospective. |
| Pinning `dir="ltr"` surprises an RTL consumer expecting mirrored corners. | Codes are LTR in every script (bidi); documented in the component JSDoc next to time-picker's identical reasoning. |
| `track $index` re-uses badge DOM on removal, so a focused remove button's DOM node may now show the next chip. | `removeChip` already refocuses the input (immediate + deferred); T-14 asserts the resulting list, T-13 the right chip is removed. |
| `kanban` consumes `chip-list`. | Run `npx vitest --run packages/components/ui/chip-list packages/components/ui/kanban` and `npm run e2e -- kanban`. |
| Toggle group items read `group.isDisabled` — a projected item outside a group (`group` null) must still work. | Keep the `group?.` optional chain; existing tests cover the standalone item. |

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
the browser leg for any `*.browser.spec.ts` touched
(`npx vitest --browser=chromium --run <file>` — never two browser runs at
once), `npm run typecheck`, `npm run typecheck:templates`, `npm run lint`.
After adding `input-otp.locales.ts` / the `lib/i18n` import:
`npx tsx packages/cli/scripts/sync-registry.ts --fix` (never hand-edit
`registry.json`).

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-15 (T-16 lands with the harness in Task 9). Replace — do not keep alongside — the existing input-otp tests that pin the old model: `should navigation with arrows` (asserts only `focusedIndex`), `should handle backspace` (asserts last-character deletion regardless of caret), `should move focus right but not past the value length`. Note each replacement in the commit message. | all | ⬜ Not started | — | — | — |
| 2 | Toggle group CVA per Decision A2: `NG_VALUE_ACCESSOR`, silent `writeValue` into `selection` (`null` → `[]`), `commit()` used by `toggle()`, `isDisabled` (group + item template), touched on `focusout` leaving the fieldset. Invariant: *every user toggle reaches the form exactly once; every form write renders and never emits.* | UC-1, UC-2, UC-3 (T-1, T-2, T-3) | ⬜ Not started | — | — | — |
| 3 | Input OTP forms: `disabled` input + `isDisabled` (`[disabled]` on the hidden input, slot click ignored), CVA per Decision A2 (`writeValue` as-is, `commit()`, touched on blur). | UC-4, UC-5 (T-4, T-5) | ⬜ Not started | — | — | — |
| 4 | Input OTP keyboard model per Decisions B, C, D: selection-is-caret, `data-active` from selection, slot row `dir="ltr"` with physical corner classes, slots presentational + `aria-hidden`, single tab stop, full-code focus selects the last slot, delete the custom Backspace branch and the `focusedIndex` signal if nothing else reads it. Screenshot LTR and RTL at 320px and 1024px. | UC-6, UC-7, UC-8, UC-9 (T-6…T-9) | ⬜ Not started | — | — | — |
| 5 | Input OTP paste per Decision E (shared sanitiser, `(paste)` replaces the code). | UC-10 (T-10) | ⬜ Not started | — | — | — |
| 6 | Input OTP default name per Decision F: `input-otp.locales.ts`, `locale` input, `createLocaleBindings`; run `sync-registry --fix`. | UC-11 (T-11) | ⬜ Not started | — | — | — |
| 7 | Signal Forms + docs follow-through: update `field-round-trip.spec.ts` (T-15); update `docs/signal-forms.md:97-101` (drop toggle group and input OTP from the non-CVA list); stories for both gain a reactive-forms example and input OTP a `disabled` control; demo pages gain copy-paste reactive-forms examples. | UC-1, UC-4 (T-15) | ⬜ Not started | — | — | — |
| 8 | Chip list per Decision G: IME guard, `track $index`, `focusFromContainer` target guard. Re-verify F-11 on the real component in the browser leg before fixing (record the before-result in the retrospective). | UC-12, UC-13, UC-14 (T-12, T-13, T-14) | ⬜ Not started | — | — | — |
| 9 | Bundle close: extend the input-otp harness (T-16) and fix its stale comment; run the §2.4 mutation check; `npm run docs:regen` (then restore `documentation.json` per project memory); `npm run e2e -- toggle-group`, `-- input-otp`, `-- chip-list`, `-- kanban`; `npm run test-visual` (full browser suite, zero failures); `npm run sonar:gate` and verify the four gate conditions in CLAUDE.md §4. | all (T-16) | ⬜ Not started | — | — | — |

---

## 6. Completion log

| Task | Completed | Score | Reviewer rationale (compressed) |
|---|---|---|---|
| — | — | — | — |
