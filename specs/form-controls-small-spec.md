# Small Form Controls — Spec

> # 🔴 STOP — READ BEFORE STARTING
>
> **Prerequisite: `signal-forms-readiness` — ✅ done.** These four controls are
> the first written *after* that work, so they are **born conformant** rather
> than converted. There is no migration here and no legacy shape to preserve.
>
> Read §3.1 before writing any component. Every one of these controls declares
> `value = model<T | null>(null)` — named exactly `value` — and provides
> `NG_VALUE_ACCESSOR`. `number-input` is the reference implementation; copy its
> `commit()` funnel rather than inventing another.
>
> **The value types in §3.2 are the load-bearing decisions.** Three of the four
> controls encode a quantity that has a wrong answer as well as a right one —
> money in floats, a wall-clock time in a `Date`, a duration in milliseconds.
> Decide those first; the rendering is the easy half.

---

## 1. Product Manager section

### 1.1 Business logic

Four controls that every real form needs and that this library does not have:

| Control | Answers |
|---|---|
| `time-picker` | "What time?" — a time of day, beside the existing `date-picker` |
| `duration-input` | "How long?" — a length of time |
| `currency-input` | "How much?" — an amount of money, formatted for a locale |
| `signature-pad` | "Do you agree?" — a hand-drawn mark |

They are grouped because they are the same shape of problem: a small control
whose difficulty is entirely in **what the value is**, not in how it looks.

### 1.2 Why the customer wants this

Today a consumer building a booking form, an invoice, or a consent flow drops
out of this library and hand-rolls the control — which means hand-rolling the
`ControlValueAccessor`, the locale formatting, the keyboard model and the
touch behaviour, four times, badly. Each of these is a day of work to do
properly and an afternoon to do wrongly.

They also complete a set. `date-picker` without `time-picker` means every
"when" field in an application is half-supported.

### 1.3 Use cases — definition of done

- **UC-1** A time of day round-trips through a signal form, a reactive form
  and a two-way binding without the value drifting or the control fighting the
  user mid-edit.
- **UC-2** A time entered as `9:05 PM` in an `en-US` app and `21:05` in a
  `de-DE` app produces the **same stored value**.
- **UC-3** An amount typed as `1.234,56` in `de-DE` and `1,234.56` in `en-US`
  produces the same number, and re-renders formatted for that locale.
- **UC-4** An amount in a zero-decimal currency (`JPY`) never shows or accepts
  a fractional part; one in a three-decimal currency (`KWD`) accepts three.
- **UC-5** A duration typed as `1:30` means an hour and a half, and survives a
  round trip through JSON.
- **UC-6** A signature can be drawn with a finger on a phone, cleared, undone
  one stroke at a time, and submitted.
- **UC-7** Every control is fully operable from the keyboard alone, and every
  control announces its value to a screen reader.
- **UC-8** Every control is usable on a touch device: 44px targets, no
  hover-only affordance, no gesture that fights the page.

### 1.4 Out of scope

- Date **and** time in one control — `date-picker` + `time-picker` compose.
- Time zones. These controls describe wall-clock time and elapsed time; an
  instant in time is a different type and a different control.
- Currency **conversion**. One amount, one currency, no rates.
- Signature verification, biometrics, or legal-grade audit trails.
- Converting the six controls the readiness spec deliberately left alone
  (`date-picker`, `date-range-picker`, `chip-list`, `native-select`,
  `tree-select`, `rich-text-editor`). Named here only because a consumer will
  notice that `time-picker` conforms and the `date-picker` beside it does not.

---

## 2. QA section — write these tests FIRST

### 2.1 Traceability

| Test | Proves |
|---|---|
| `T-value-model` | `value` is a `ModelSignal`, so the control satisfies `FormValueControl` |
| `T-cva-roundtrip` | `writeValue` renders, a user edit calls `onChange`, `setDisabledState` disables |
| `T-no-feedback-loop` | `writeValue` does **not** re-emit — Risk R-3 |
| `T-focus-safe` | A programmatic write while the control is focused does not clobber the caret |
| `T-locale-parse` | UC-2, UC-3, UC-4 |
| `T-serialise` | UC-5 — the value survives `JSON.parse(JSON.stringify(v))` unchanged |
| `T-keyboard` | UC-7 |
| `T-touch` | UC-6, UC-8 |
| `T-a11y` | axe clean; value announced |

### 2.2 Edge cases every control must cover

Inherited verbatim from `signal-forms-readiness` §2.3, because they are the
cases that broke controls last time:

- Empty / `null` initial value.
- Programmatic change **while the control is focused** — must not fight the
  user.
- `disabled` set before *and* after first render.
- RTL rendering.
- Touch interaction.
- **Feedback-loop check** — `writeValue` must not re-emit and re-enter.

Plus, specific to this bundle:

- A value that cannot be represented: `25:00`, a negative duration, `NaN`,
  `Infinity`, an amount with more decimals than the currency allows.
- A locale whose decimal separator is a comma and whose group separator is a
  dot, and one that uses a non-breaking space as the group separator (`fr-FR`)
  — the character `Intl` emits is **not** a plain space, and a parser that
  assumes it is will reject its own formatter's output.

### 2.3 Coverage expectation

No uncovered lines in any new file. These are new components, so there is no
"keeps its current percentage" escape hatch — the bar is the whole file.

---

## 3. Architecture

### 3.1 The conformance contract — non-negotiable

Every control in this bundle:

```ts
readonly value = model<T | null>(null);          // named `value`, always
providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => X), multi: true }]
```

and routes **every** user-driven change through one funnel, copied from
`number-input`:

```ts
private commit(value: T | null): void {
  this._currentValue.set(value);   // what is rendered
  this.onChange(value);            // tell the form
  this.value.set(value);           // emit valueChange exactly once
}

writeValue(value: T | null): void {
  this._currentValue.set(value);   // render only — never emits
}
```

The split between `_currentValue` and `value` is the whole feedback-loop
defence: a form writing in must not look like a user typing.

`disabled` is an `input()` OR-ed with a private `_formDisabled` signal that
`setDisabledState` writes, so a reactive-forms `disable()` and a template
`[disabled]` both win.

### 3.2 Value types — the decisions that matter

#### `time-picker` — `string | null`, `"HH:mm"` (24-hour, zero-padded)

`"HH:mm"`, or `"HH:mm:ss"` when `withSeconds` is set.

**Not a `Date`.** A `Date` is an instant, and a time of day is not: it has no
date and no time zone. Storing `14:30` as a `Date` forces a date part —
invariably `1970-01-01` — which then shifts across midnight the moment anything
converts time zones, so `14:30` becomes `13:30` or the day before. The bug is
invisible until a user in another zone opens the form.

`"HH:mm"` is what `<input type="time">` uses, what a SQL `TIME` column takes,
and what JSON round-trips unchanged. **The stored value is always 24-hour** —
12-hour is a rendering choice made from the locale (UC-2).

#### `duration-input` — `number | null`, in **seconds**

**Not milliseconds:** nobody types a duration in milliseconds, and the extra
three digits buy only float noise and unreadable test fixtures.

**Not an ISO-8601 string** (`PT1H30M`): the point of a duration is arithmetic,
and a number does it directly. ISO-8601 is a *serialisation* format; helpers
`formatIso8601()` / `parseIso8601()` ship alongside for consumers whose API
speaks it, and neither is the value type.

#### `currency-input` — `number | null`, in **major units**

`12.34` means twelve dollars thirty-four.

This is the one decision where the safest engineering answer and the expected
one disagree. Integer **minor units** (1234 cents) cannot drift; major units
are a float, and floats and money are a known hazard.

Major units wins because the alternative is worse in practice: a consumer
binding `[(value)]` to a field their API calls `price` will get `1234` where
they expect `12.34`, and will divide by 100 by hand — reintroducing the float,
in their code, without the rounding this control does. Surprise costs more than
the drift here.

The drift is then **bounded rather than ignored**: every commit rounds to the
currency's own scale, taken from
`Intl.NumberFormat(locale, { currency }).resolvedOptions().maximumFractionDigits`
— 2 for `USD`, 0 for `JPY`, 3 for `KWD` (UC-4). A value can therefore never
carry more precision than the currency has, which is where accumulated float
error becomes visible.

`minorUnits()` is exposed as a computed for consumers who want the integer.

#### `signature-pad` — `string | null`, a `data:image/png;base64,…` URL

A form value has to be a submittable scalar, and a data URL is the shape that
every backend, `<img src>` and PDF renderer already accepts.

The strokes themselves — the useful, resolution-independent form — are kept
alongside as a readonly signal and re-rendered on resize, so the pad is not
a bitmap that blurs when the layout changes. `toDataURL(type)` exposes other
formats without widening the value type.

### 3.3 Rendering and interaction

**`time-picker` and `duration-input` are segmented fields**, not free text and
not three separate inputs: hour / minute / (second), each independently
focusable, arrow keys stepping the segment under the caret, typing digits
advancing automatically. This is how `<input type="time">` behaves, and
matching it means muscle memory transfers.

`time-picker` shows a meridiem segment only when the resolved locale is
12-hour, decided by
`Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12`
rather than a hand-kept list of locales.

**`currency-input`** formats on blur and parses on input, never mid-keystroke:
reformatting while someone is typing moves the caret out from under them.

**`signature-pad`** draws with pointer events on a `<canvas>` sized to its
device pixel ratio. Touch is a first-class input, not an afterthought:
`touch-action: none`, a second finger abandons the stroke rather than drawing
a spike (see `isSecondaryTouch` in `lib/touch.ts` — the node editor learned
this the hard way), and Clear and Undo are 44px targets.

### 3.4 Accessibility

Segmented fields use `role="spinbutton"` per segment with `aria-valuenow`,
`aria-valuemin`, `aria-valuemax` and `aria-valuetext` — the last so a screen
reader says "9 hours" rather than "9".

**`signature-pad` cannot be made accessible by labelling it.** A drawn mark is
irreducibly visual and irreducibly motor. The control ships with a documented
requirement that consumers offer an alternative — typically a typed-name field
— and the demo shows one. Saying so in the docs is the honest position;
claiming an `aria-label` solves it would not be.

### 3.5 Risks

| Risk | Mitigation |
|---|---|
| **R-1** A locale's number is not ASCII. Separators are not the characters they look like, and **the digits may not be digits** | Ask `Intl` for everything — see §3.6, spiked and passing before any code was written |
| **R-2** Segmented fields are easy to get wrong for RTL | Order follows `formatToParts`. **Measured (§3.7): h:m:s never reorders — the *meridiem* does.** `zh-TW` puts it first. The group is explicitly `dir="ltr"`, because no locale reads a clock right-to-left |
| **R-3** Feedback loop between `writeValue` and `value` | The `_currentValue` split in §3.1, with an explicit test |
| **R-4** Canvas signature blurs on resize or on a HiDPI screen | Strokes are the source of truth; the bitmap is a projection re-rendered at `devicePixelRatio` |
| **R-5** Rounding to currency scale silently changes a value the consumer set | Only user commits round; `writeValue` renders what it was given |

### 3.6 R-1 spike — run before writing the control, 2026-08-21

The assumption worth testing first was that a currency field can parse back
what it formatted. It can, but only by asking `Intl` for every piece of the
answer. Measured output:

| Locale | `format(12345.6)` | Trap |
|---|---|---|
| `en-US` | `$12,345.60` | — |
| `de-DE` | `12.345,60 €` | dot groups, comma decimal; `U+00A0` before the symbol |
| `fr-FR` | `12 345,60 €` | that space is **`U+202F`**, not `U+0020` |
| `ja-JP` | `￥12,346` | rounded to 0 decimals by the currency's own scale |
| `ar-EG` | `‏١٢٬٣٤٥٫٦٠ ج.م.‏` | **Arabic-Indic digits**, `U+066C` group, `U+066B` decimal, `U+200F` marks |

**The `ar-EG` row is the one that matters, and the spec understated it before
the spike.** R-1 was written as a separator problem; it is also a *digit*
problem. `١٢٣` is not `123`, so a parser built on `[0-9]` — or on
`Number.parseFloat` alone — does not merely mis-parse Arabic input, it returns
`null` for the exact string it produced a moment earlier. This library ships
`ar` locales throughout, so that is a shipping bug, not a hypothetical.

The parser therefore derives three things from `Intl` and hard-codes none:

1. the group separator and decimal separator, from `formatToParts`;
2. a digit map, by formatting `0`–`9` in the target locale;
3. the fraction scale, from `resolvedOptions().maximumFractionDigits`.

Round-trip verified across `en-US`, `de-DE`, `fr-FR`, `ja-JP`, `ar-EG` and
`en-IN` (which groups by lakh) before a line of the component existed. That
check becomes `T-locale-parse`, table-driven over the same six locales.

### 3.7 R-2 sweep — run before `time-picker`, 2026-08-24

R-2 said segmented fields are easy to get wrong for RTL, and proposed taking
the segment order from `formatToParts` rather than hard-coding `h:m:s`. The
sweep was run over **82 locales** to find out where the order actually varies.

**R-2 was aimed at the wrong axis.** `hour > minute > second` held in every
single locale, RTL included — `he`, `ar`, `fa`, `ur` and `ps` all read a clock
left-to-right. There is no locale that reads `05:23` for half past eleven at
night.

What varies is the **meridiem**:

| Layout | Locales | Example |
|---|---|---|
| `hour > minute > second` | 58 | `de-DE` → `23:05:09` |
| `hour > minute > second > dayPeriod` | 21 | `en-US` → `11:05:09 PM` |
| `dayPeriod > hour > minute > second` | **3** (`ko`, `ko-KR`, `zh-TW`) | `zh-TW` → `下午9:05` |

Three other measurements came out of the same sweep:

- **Only two hour cycles occur in practice**: `h23` (58 locales) and `h12`
  (24). No `h11`, so there is no locale where midnight reads `0 AM`, and a
  `hour12` boolean is enough — the full `hourCycle` is not needed.
- **The half-day names are not `AM`/`PM`.** `ar-EG` says `ص`/`م`, `zh-TW` says
  `上午`/`下午`, `am-ET` says `ጥዋት`/`ከሰዓት`. Taken from `formatToParts` per
  locale, never from a list this library would have to maintain.
- **R-1 applies again.** `ar-EG` renders `٩:٠٥` and an Arabic keyboard types it
  back, so segment parsing maps through the locale's digits. That mapping is
  now shared: `localeDigits` / `toAsciiDigits` in `lib/i18n`.

**Consequence for the implementation.** The group is explicitly `dir="ltr"`.
That is not an oversight about RTL — it is the measured result: in an RTL page
a default-direction flex row would reverse the boxes and render `23:05` as
`05:23`, which is not a different convention, just wrong. Order still comes
from `formatToParts`, which is what puts the meridiem first in `zh-TW`.

---

## 4. Definition of Done (per task)

Same five criteria as `signal-forms-readiness` §4, with its cadence amendment:

**Per task:** targeted tests for the changed files, `npm run lint` clean,
`npm run typecheck:templates` clean (not just `tsc --noEmit` — it is the only
thing that catches a widened model type at a call site), review gate ≥ 91.

**Once per bundle, after the last task:** full `npm run coverage` then
`npm run sonar`, every issue on the changed code fixed and re-scanned until
clean. If the token, server or Docker is unavailable the bundle is **blocked,
not done**.

Each control additionally ships: unit spec, Storybook story, demo page entry,
e2e harness (`npm run e2e:scaffold -- <name>`), and a registry entry with
`sync-registry --fix`.

---

## 5. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|---|---|---|---|---|---|
| T-1 | `currency-input` | §3.2 money, UC-3, UC-4, R-1 | ✅ | 2026-08-24 | — | Spike caught more than the spec predicted (`ar-EG` digits), and the browser caught more than the spike (`ج.م.` contains full stops). Building it surfaced a shipped bug in three other controls — see §6. |
| T-2 | `duration-input` | §3.2 seconds, UC-5, segmented field | ✅ | 2026-08-24 | — | The interesting decisions were both about what a *partial* entry means: which unit absorbs the overflow, and which end a short entry aligns to. Neither is arbitrary and neither was in the spec. |
| T-3 | `time-picker` | §3.2 wall clock, UC-1, UC-2, R-2 | ✅ | 2026-08-24 | — | The sweep disproved the risk as written and found a different one under it. Two feedback loops, one hidden behind the other; the second was caught only by a reactive-form test. |
| T-4 | `signature-pad` | UC-6, R-4, §3.4 honesty | ✅ | 2026-08-24 | — | The only control here whose hardest question is not technical. Keeping strokes rather than a bitmap also answered a question the spec had not asked: what happens to a *saved* signature loaded back in. |
| T-5 | Bundle close | coverage, Sonar, docs regen, publish note | ✅ | 2026-08-24 | — | The Sonar server found 13 issues that eslint had passed clean — the gate earned its place. One of them was a real a11y improvement, not a rule to be argued with. |

`currency-input` is first because it exercises the locale machinery (R-1) that
the two segmented controls then reuse, and because its value decision is the
one most likely to be argued with — better argued in review over one small
control than after four are written to match it.

---

## 6. Completion log

### T-1 `currency-input` — 2026-08-24

**Built.** `value = model<number | null>` in major units, `NG_VALUE_ACCESSOR`,
the `commit()` funnel from `number-input`, and a separate
`currency-input.format.ts` holding every locale decision. 78 unit tests, 8 e2e
against a real consumer install, portable spec registered in
`portable-tests.json`.

**The spike understated the risk, and the browser understated it again.**
§3.6 recorded that `ar-EG` uses Arabic-Indic digits. What neither the spec nor
the Node spike caught is that the Egyptian pound symbol is `ج.م.` — it
*contains full stops*. A parser that keeps "digits and dots" is then holding
`12345.60..`, reads three decimal points, and rejects the amount. The Node
spike passed only because it lacked the multi-dot guard; the stricter component
version failed immediately. The parser now removes the symbol **by name** from
`formatToParts`, which is the only way to tell a decimal point from a full stop
inside a currency name.

**A shipped bug in three other controls, found on the way.** `ui-input`
exposes no `blur` output, and `blur` does not bubble — so `(blur)` bound on
`<ui-input>` never fired. Measured: the inner field's blur fires, the host
receives 0, `focusout` receives 1, and Angular's binding runs 0 times.

Three components did this, out of ~170 — which is why nobody noticed:

- `number-input` — clamping never ran for a real user. Typing `250` into a
  `max="100"` field and clicking away left `250`.
- `phone-input`, `chip-list` — the control was never marked `touched`, so any
  validation gated on `ng-touched` never appeared.

All three now use `focusout`, each with a regression test that performs a
**real** blur. Every existing blur test in those files called `onBlur()`
directly, which is exactly why 40+ tests per component missed it.

**Two conventions learned and followed.** No spec in `portable-tests.json`
imports `axe-core` — those files ship to consumers, who do not have it — so
accessibility is covered by the Storybook axe pass instead. And money is
asserted in **minor units**: `12.35` is not exactly representable, so an
integer `1235` says what is actually meant and satisfies the float-equality
rule for the right reason rather than by loosening the assertion.

**One base addition.** `ui-input` gained `inputMode` and `lang` inputs. A
currency field cannot use `type="number"` — that refuses the comma most of
Europe uses as a decimal separator — but it still wants a numeric keypad, and
there was no way to ask for one without reaching past the component.

### T-2 `duration-input` — 2026-08-24

**Built.** `value = model<number | null>` in **seconds**, `NG_VALUE_ACCESSOR`,
the same `commit()` funnel, and `duration-input.format.ts` holding the
arithmetic. Segments are individually-focusable `role="spinbutton"` inputs
inside a `role="group"`, which is how `<input type="time">` behaves — the
muscle memory already exists. 74 unit tests, 6 e2e against a real consumer
install, portable spec registered, story and demo page in place.

**Two decisions the spec did not contain, both about partial data.**

*Which unit absorbs the overflow.* A field configured `['minutes','seconds']`
holding 5400 seconds must render `90:00`. The obvious implementation splits
into h/m/s and renders only the units on show — which displays `30:00` and
silently drops an hour the moment any segment is touched. The largest unit on
show now absorbs everything above it. This is the difference between a
display bug and a data-loss bug, and only the second reading is defensible.

*Which end a short entry aligns to.* Typing `30` into an `h:mm` field means
thirty **minutes**. Reading it left-to-right as thirty hours is what a naïve
split does and is indefensible; a clock reads from the right, so parsing does
too. The units are a parameter to `parseDuration` rather than a guess for
exactly this reason: `1:30` is ninety minutes or ninety seconds depending
entirely on what the field is showing, and the text alone cannot say which.

**Bounded segments wrap; the leading one does not.** Stepping 59 minutes up
reads `00`, not a stuck `59` — sticking looks like the control has stopped
responding. The leading segment has no bound to wrap around, which is the same
rule as the overflow decision seen from the other side.

**ISO-8601 ships as a helper, not as the value.** `formatIso8601` /
`parseIso8601` are there for APIs that speak it, but the value is a number
because the point of a duration is arithmetic and `PT1H30M` has to be parsed
before you can do any. The parser accepts whole seconds only: the value holds
whole seconds, so a fractional one would be floored on the way in and the
control would be quietly lying about what it stored. Days and up are refused —
a day is not a fixed length once a calendar is involved.

**Nothing new about blur.** The real-blur regression test from T-1 was written
in from the start rather than discovered again, and `focusout` sits on the
group because `blur` does not bubble and there are three fields under it.

### T-3 `time-picker` — 2026-08-24

**Built.** `value = model<string | null>` holding `"HH:mm"` (or `"HH:mm:ss"`),
always 24-hour, `NG_VALUE_ACCESSOR`, and `time-picker.format.ts` holding every
locale decision. Segments are `role="spinbutton"` inputs in a `role="group"`,
with the meridiem as a button because there is nothing to type into it. 90 unit
tests, 12 e2e against a real consumer install, portable spec registered, story
and demo page in place.

**The risk was real; the mitigation was aimed at the wrong axis.** §3.7 records
the 82-locale sweep. `h > m > s` never reorders — not in `he`, `ar`, `fa`,
`ur` or `ps`. What varies is the meridiem: `ko`, `ko-KR` and `zh-TW` put it
first (`下午9:05`). Had R-2 been mitigated as written — "read the order from
`formatToParts`" — the code would have been right by accident, for a reason
that does not hold. It now reads the order *and* forces `dir="ltr"` on the
group, because the thing RTL actually breaks is the flex direction: a
default-direction row renders `23:05` as `05:23`.

**Two feedback loops, the second hidden behind the first.**

The first was the one §3.1 predicts. An hour with no minute is not a time, so
the commit emits `null` — which came straight back through the model and wiped
the digit that had just been typed. Guarded by comparing the incoming value
against what the segments already add up to, so an echo of our own commit is
distinguishable from a form genuinely clearing the field.

That guard created the second. Recognising an echo means *reading* the segment
signals, and doing that inside an `effect` made the effect depend on them — so
every segment change re-ran it holding a `value` that had not caught up, and it
cleared the field it had just filled. The unit tests driving the two-way
binding all passed; only the reactive-form test failed, because there `value`
stays `null` and the divergence is visible. The effect now wraps `render` in
`untracked`: its dependency is `value`, and only `value`.

Worth stating plainly, because it is the same lesson as T-1 from the other
side: the two-way tests passed not because the code was right but because the
host kept `value` in step, which masked the fault. It took a *differently
shaped* consumer to show it.

**One shared addition.** `localeDigits` and `toAsciiDigits` now live in
`lib/i18n`. `currency-input` had grown the same logic privately, and
`time-picker` needed it for exactly the same reason — `ar-EG` renders `٩:٠٥`
and an Arabic keyboard types it back. `duration-input` does not use them: its
value is unit-based and takes no locale, which is a real gap for an
Arabic-speaking user and is recorded here rather than fixed silently outside
its task.

### T-4 `signature-pad` — 2026-08-24

**Built.** `value = model<string | null>` holding a PNG data URL,
`NG_VALUE_ACCESSOR`, and `signature-pad.strokes.ts` holding the geometry as
pure functions. 48 unit tests, 9 e2e against a real consumer install, portable
spec registered, story and demo in place.

**R-4 is really a question about what you store.** Keeping the bitmap makes
resize unanswerable: re-scale it and the signature blurs, throw it away and the
signature is gone. Keeping the *strokes* — normalised to the pad, 0–1 on both
axes — makes the bitmap a projection that can be redrawn at any size and any
`devicePixelRatio`. The e2e asserts the backing store equals
`css width × devicePixelRatio`, which is the property that actually keeps a
signature crisp on a retina screen; asserting it in a unit test would have
proved only that jsdom reports a ratio of 1.

The trade is stated rather than hidden: a pad that changes **aspect ratio**
stretches the mark instead of letterboxing it. That is the right way round for
a signature — a stretched signature is still recognisably the same signature,
while one letterboxed into a corner looks like a bug.

**A question the spec did not ask: what about a signature loaded back in?**
A PNG cannot be turned back into strokes, so a value written in from a form
is rendered as a backdrop *underneath* the live strokes rather than pretended
to be editable. New strokes draw on top and the committed image contains both;
Undo removes strokes and never the backdrop, because the backdrop was not a
stroke this pad made. Without this, `writeValue` on a saved signature would
have rendered a blank pad — the value would have round-tripped in name only.

**The echo guard, third variation.** Same shape as T-1 and T-3: the commit sets
`value`, the effect sees it, and re-adopting it would replace the live strokes
with a flat image and quietly make Undo useless. Guarded by remembering the
last emitted URL. Three controls in a row have needed a version of this, which
says the `writeValue`/`value` split in §3.1 is load-bearing rather than
ceremonial.

**Touch, and a lesson borrowed rather than relearned.** A second finger
abandons the stroke instead of dragging a spike across the signature —
`isSecondaryTouch` from `lib/touch.ts`, which the node editor paid for. The
test was verified by **reverting the guard**: without it, the stroke survives
and the assertion fails. A guard whose test still passes when the guard is gone
is not a test.

**§3.4 is the honest part, and it cost the most to get right.** This control
cannot be made accessible by labelling it. A drawn mark is irreducibly visual
and irreducibly motor: it cannot be produced with a keyboard, a switch, or a
screen reader, and no attribute changes that. The canvas carries `role="img"`
and a name so it is *announced* correctly, and it is focusable so it does not
break tab order — but neither of those is access, and saying they were would
be the dishonest version. The requirement is stated in the component docs, in
the Storybook page, and the demo actually implements the alternative: a
draw-or-type choice where the typed name carries the same weight. A demo that
only described the alternative would be making the same claim it warns about.

### T-5 Bundle close — 2026-08-24

**Gates, all green.**

| Gate | Result |
|---|---|
| Full browser suite | 495 files / **10,204 tests**, 0 failures |
| CLI suite | 71 files / **1,392 tests**, 0 failures |
| `npm run check:all` | eslint + `tsc` + `ngc` template check, clean |
| e2e (real consumer installs) | `currency-input` 8, `duration-input` 6, `time-picker` 12, `signature-pad` 9, `number-input` 1 |
| Docs | regenerated and verified current — 178 components |
| SonarQube server scan | project open issues **19 → 7** |

**The Sonar gate earned its keep.** eslint passed all four components clean;
the server then reported **13** issues on them. That is the whole argument for
why the eslint subset is not a substitute, made concrete:

| Finding | Count | Resolution |
|---|---|---|
| `Web:S6819` — group role | 2 | `<div role="group">` → native `<fieldset>` |
| `Web:AvoidCommentedOutCodeCheck` | 5 | Explanations moved into the TypeScript docs |
| `typescript:S7755` | 3 | `[arr.length - 1]` → `.at(-1)` |
| `typescript:S6582` | 1 | Optional chain |
| `MouseEventWithoutKeyboardEquivalent` | 2 | Documented exemption — see below |

**One of them was a real improvement rather than a rule to be satisfied.**
S6819 on the segmented fields was correct: a named group of related controls
is what a `<fieldset>` *is*, and both `time-picker` and `duration-input` were
wearing an ARIA role over a `div` instead. Converting them carries the
semantics natively and needed only a UA-style reset. The tests were changed to
assert the native tag rather than the role, which is a better assertion than
the one they replaced.

The commented-out-code findings are the interesting near-miss. The comments
were prose, not dead code — but they quoted attributes and tag names, which is
indistinguishable from commented-out markup to a static HTML analyzer. The fix
was not to obfuscate the prose but to move it into the component's TypeScript
docs, where it is closer to the code it explains and where the API docs pick
it up. Better placement, arrived at by way of a linter complaint.

**Two findings remain, both the documented `<ui-button (click)>` exemption.**
`ui-button` renders a native `<button>`, which is already keyboard-activatable;
adding a key handler would fire the action **twice** on Enter. This exemption
predates this bundle and is scoped to that one primitive — `signature-pad` was
added to the existing table in `docs/sonarqube-accepted-findings.md` rather
than given a new rationale.

The other 5 open project issues are pre-existing node-editor findings on files
this bundle never touched.

**No npm publish required.** The only change under `packages/cli/` is the
regenerated offline registry snapshot (`registry/index.ts`). No CLI logic, no
`ComponentDefinition` shape change, no utils baselines — so all four components
go live from `master` on merge, per the boundary in `CLAUDE.md`.

**One gap recorded rather than papered over.** `duration-input` parses ASCII
digits only. Its value is unit-based and it takes no locale, so it never
acquired the `localeDigits` / `toAsciiDigits` handling that `currency-input`
and `time-picker` share — which means an Arabic-speaking user typing `٣٠` gets
nothing. That is a real defect, it is outside T-2's scope as specified, and it
is written down here instead of being fixed silently or left unmentioned.

### Post-review pass — 2026-08-24

The demo pages were reviewed in a browser after the bundle closed. Everything
below was found by *looking at the rendered page*, and none of it was caught by
the 10,204 tests, the e2e suites, lint, or the Sonar scan.

**`duration-input` rendered a 181px box for a one-digit hour.** The leading
segment carried `first:w-auto`, and an `<input>` with `width: auto` falls back
to its `size` attribute — which defaults to **20 characters**. So `1 : 30` was
drawn as a one-character digit floating in a 181px field. Segments are now
sized to the digits they actually hold: the widest, `5400`, gets 5ch, and the
pad went from 232px to 77px.

**Both segmented fields stretched to full width inside a form field.**
`inline-flex` does not survive being a grid or flex item — the child is
*blockified*, so the ISO example rendered 672px wide around 111px of content.
`w-fit` on the wrapper fixes it, and a consumer wanting full width can still
pass `class="w-full"`, which wins through `cn()`.

**`page-header` disproved its own caption.** Its narrow example is labelled
"actions stack below the title" and the actions sat beside a title broken
mid-word into "Invoi / ces". The cause: `sm:flex-row` asks how wide the
**window** is, and the demo simulates narrow with a 320px **container**. Any
page header in a split pane, a dialog or a sidebar-narrowed page had the same
bug. The row now wraps, so the actions drop when they genuinely do not fit —
no threshold to guess, and a header with six buttons wraps sooner than one with
a single button. UC-7 states the rule in viewport terms, so `max-sm:flex-col`
was kept alongside rather than quietly overruling the spec.

**Its tests asserted class strings, so they could not have caught it.**
`expect(row.className).toContain('sm:flex-row')` passes whether or not anything
ever stacks. Replacing it took three attempts, each verified by reverting the
fix:

1. Geometry in a 320px container — **passed against the broken markup**. The
   runner's own window is under 640px, so the old `flex-col` stacked the
   actions for the wrong reason.
2. The same test with the viewport class removed first — **also passed**, since
   the old markup's class is plain `flex-col`, so the removal was a no-op.
3. Resolved computed style (`flex-wrap: wrap` on the row, a real `flex-basis`
   on the title) — **fails when the fix is reverted**, which is the property
   that was wanted.

Worth stating plainly: two "real evidence" tests in a row were themselves
proxies, and only reverting the fix exposed that. A test is not evidence until
it has been seen to fail.

**API documentation was incomplete across the library, not just here.** The
`docs:regen` step run at bundle close skipped `docs:json` and `docs:api`, so
none of the four new components had API tables at all. Regenerating exposed the
wider gap: input and output descriptions sat at **96%** library-wide, and the
four new controls were the worst offenders at 57–73%. All 83 undocumented
members across 25 files now carry JSDoc — **1,978 / 1,978, every component at
100%**.

**The API tables rendered JSDoc as raw text.** 632 members use `{@link …}` and
1,130 use backticks, so tables showed `` `setDisabledState` `` and
`{@link withSeconds}` verbatim. A small pure pipe in the demo unwraps both.
Deliberately not HTML: the alternative is `innerHTML` plus a sanitizer, and no
table cell here needs markup badly enough to be worth an injection surface.

### Methods in the API tables — 2026-08-24

`signature-pad` ships `hideControls`, an input whose whole purpose is letting a
consumer supply their own toolbar — which is only possible by calling `clear()`
and `undo()` from outside. `toDataURL()` is the only route to SVG or JPEG,
because §3.2 deliberately keeps the value a PNG. The demo already calls it via
`viewChild`. So all three are consumer API, and none of them appeared in the
docs.

My first answer — "methods aren't in the schema, that's platform-wide" — was
true and beside the point. A component that advertises `hideControls` while
hiding the methods that make it usable is self-contradictory, and that is not
the platform's fault.

**Opt-in rather than "all public methods".** 770 methods are public across the
library, and most are template plumbing that is public only incidentally:
`getPanelId`, `formatAxisValue`, `castMenuData`, `toString`. Publishing all of
them would bury the handful a consumer is meant to call. A method now opts in
with a `@publicApi` JSDoc tag, so the decision sits at the declaration. Exactly
three methods are published library-wide today — the three above.

**The marker cannot travel through compodoc.** compodoc drops tags it does not
recognise: `jsdoctags` carries only `@param` and friends, and the tag line is
stripped from the description as well. The extractor therefore reads the marker
from the source file through an injected `SourceReader`, which also keeps the
tag next to the declaration where it belongs.

Two things that only showed up by looking at the rendered page:

- A tag with **wrapped prose after it** leaks. compodoc removed the
  `@publicApi …` line but kept its continuation, so `toDataURL` rendered
  "…what a PDF actually wants. reach the other formats." The tags are bare now
  and the prose lives in the description body.
- The template literal broke when the HTML comment I added contained
  backticks around `@publicApi` — inside a component's inline template, a
  backtick ends the string.

Per "this is version 0, don't retrofit": `methods` is a **required** field and
the extract went to **version 2** rather than being smuggled in as optional.
Every reader, guard and fixture was updated to match — including two fixtures
that had used `version: 2` as their *invalid* case, which the bump silently
turned valid.
