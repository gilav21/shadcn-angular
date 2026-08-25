import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { UI_LOCALE_ID } from '../../lib/i18n';
import {
  dayPeriodFor,
  displayHour,
  formatTimeValue,
  hoursFromDisplay,
  parseSegmentDigits,
  parseTimeValue,
  segmentBounds,
  segmentDisplay,
  stepSegment,
  timeLayout,
  type DayPeriod,
  type TimeLayout,
  type TimeSegmentKind,
} from './time-picker.format';

const timePickerWrapperVariants = cva(
  'inline-flex w-fit items-center gap-0.5 border-input bg-transparent px-2 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] aria-disabled:pointer-events-none aria-disabled:opacity-50',
  {
    variants: {
      variant: {
        outline: 'dark:bg-input/30 rounded-lg border',
        underline: 'rounded-none border-b border-x-0 border-t-0 shadow-none focus-within:ring-0',
        ghost: 'border-none shadow-none focus-within:ring-0',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
);

export type TimePickerVariant = 'outline' | 'underline' | 'ghost';

/** One rendered piece of the field: a number box, or the meridiem button. */
export interface TimeSegment {
  readonly kind: TimeSegmentKind;
  readonly text: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly label: string;
  /** The separator that follows this segment; empty after the last one. */
  readonly separator: string;
}

/** How a segment is named to a screen reader, in the app's own language. */
const SEGMENT_LABEL: Record<TimeSegmentKind, string> = {
  hour: 'hour',
  minute: 'minute',
  second: 'second',
  dayPeriod: 'AM or PM',
};

/** Which way an arrow key moves a segment; 0 for a key this control ignores. */
function stepFor(key: string): number {
  if (key === 'ArrowUp') return 1;
  if (key === 'ArrowDown') return -1;
  return 0;
}

/**
 * A time of day, edited one segment at a time.
 *
 * ### The value is `"HH:mm"`, never a `Date`
 *
 * A `Date` is an instant and a time of day is not — see
 * `specs/form-controls-small-spec.md` §3.2. `"HH:mm"` is what
 * `<input type="time">` uses, what a SQL `TIME` column takes, and what JSON
 * round-trips unchanged. The stored value is always 24-hour; **12-hour is a
 * rendering choice**, made from the locale rather than from an input.
 *
 * ### The layout comes from the locale
 *
 * Segment order, separators, the names of the two halves of the day and the
 * digits themselves are all read from `Intl` — see §3.7 for the 82-locale
 * sweep behind that. `zh-TW` renders `下午9:05`, meridiem first, and this
 * control renders it that way because the locale says so, not because anything
 * here knows about Chinese.
 *
 * ### Incomplete is empty
 *
 * An hour with no minute is not a time, so the value stays `null` until both
 * are set. This is what a native time input does, and anything else means a
 * form can submit half a reading.
 *
 * ### Why a fieldset, and why it is forced left-to-right
 *
 * The segments are a named group of related controls, which is what a
 * fieldset *is* — so the grouping is carried by a native element rather than
 * by an ARIA role bolted onto a div.
 *
 * The direction is pinned left-to-right on purpose, and it is measured rather
 * than assumed: across all 82 locales in the §3.7 sweep the hour always
 * precedes the minute, because no locale reads a clock right-to-left. In an
 * RTL page a default-direction row would reverse the boxes and render 23:05
 * as 05:23 — not a different convention, just wrong.
 *
 * Focus is watched with the bubbling focusout event rather than blur, because
 * blur does not bubble and moving between two segments is not leaving the
 * control.
 */
@Component({
  selector: 'ui-time-picker',
  exportAs: 'uiTimePicker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePickerComponent),
      multi: true,
    },
  ],
  templateUrl: './time-picker.component.html',
  styleUrl: './time-picker.component.css',
  host: { class: 'contents' },
})
export class TimePickerComponent implements ControlValueAccessor {
  /**
   * The time as `"HH:mm"`, or `"HH:mm:ss"` with {@link withSeconds}.
   *
   * A `model()` named exactly `value` is what makes this a valid Signal Forms
   * `FormValueControl`, and it doubles as the `valueChange` output.
   */
  readonly value = model<string | null>(null);

  /** BCP-47 tag. Falls back to the app-wide `UI_LOCALE_ID`. */
  readonly locale = input<string>();
  /** Adds a seconds segment, and widens the value to `"HH:mm:ss"`. */
  readonly withSeconds = input<boolean>(false);
  /** OR-ed with the state a reactive form pushes via `setDisabledState`. */
  readonly disabled = input<boolean>(false);
  /** Accessible name for the group of segments. */
  readonly ariaLabel = input<string>('Time');
  /** Extra classes merged onto the wrapper. */
  readonly class = input('');
  /** Visual style of the wrapper: `outline`, `underline` or `ghost`. */
  readonly variant = input<TimePickerVariant>('outline');

  private readonly globalLocale = inject(UI_LOCALE_ID);

  private readonly _hours = signal<number | null>(null);
  private readonly _minutes = signal<number | null>(null);
  private readonly _seconds = signal<number>(0);
  private readonly _period = signal<DayPeriod>('am');
  private readonly _formDisabled = signal(false);

  readonly resolvedLocale = computed(() => this.locale() ?? this.globalLocale());
  readonly isDisabled = computed(() => this.disabled() || this._formDisabled());

  readonly layout = computed<TimeLayout>(() =>
    timeLayout(this.resolvedLocale(), this.withSeconds()),
  );

  readonly segments = computed<readonly TimeSegment[]>(() => {
    const layout = this.layout();
    return layout.order.map((kind, index) => ({
      ...this.describe(kind, layout),
      separator: layout.separators[index] ?? '',
    }));
  });

  /** What a screen reader hears for the whole control. */
  readonly valueText = computed(() => {
    const time = this.value();
    if (time === null) return '';
    return this.segments()
      .map(segment => segment.text)
      .join(' ');
  });

  readonly wrapperClasses = computed(() =>
    cn(timePickerWrapperVariants({ variant: this.variant() }), this.class()),
  );

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    /*
     * `untracked`, because `render` reads the segment signals to recognise an
     * echo of our own commit — and an effect that tracked them would re-run
     * whenever a segment changed, holding a `value` that had not caught up
     * yet, and clear the field it had just filled in. The dependency this
     * effect is meant to have is `value`, and only `value`.
     */
    effect(() => {
      const incoming = this.value();
      untracked(() => this.render(incoming));
    });
  }

  /** Digits typed into one segment, read through the locale's own glyphs. */
  onSegmentInput(kind: TimeSegmentKind, raw: string): void {
    const typed = parseSegmentDigits(raw, this.layout().digits);
    if (typed === null) {
      this.clear(kind);
      return;
    }

    const bounds = segmentBounds(kind, this.layout().hour12);
    this.apply(kind, Math.min(Math.max(typed, bounds.min), bounds.max));
  }

  /** Arrow keys step the segment under the caret, as a spinbutton does. */
  onSegmentKeydown(kind: TimeSegmentKind, event: KeyboardEvent): void {
    const step = stepFor(event.key);
    if (step === 0) return;

    event.preventDefault();
    const layout = this.layout();
    if (kind === 'dayPeriod') {
      this.togglePeriod();
      return;
    }

    const bounds = segmentBounds(kind, layout.hour12);
    const current = this.describe(kind, layout).value;
    this.apply(kind, stepSegment(current, step, bounds));
  }

  /** The meridiem is a two-state control, so activating it flips it. */
  togglePeriod(): void {
    const next: DayPeriod = this._period() === 'am' ? 'pm' : 'am';
    this._period.set(next);

    const hours = this._hours();
    if (hours !== null) {
      this._hours.set(hoursFromDisplay(displayHour(hours, true), next, true));
    }
    this.commit();
  }

  onBlur(): void {
    this.onTouched();
  }

  /** Renders a form value as-is, without emitting. */
  writeValue(value: string | null): void {
    this.render(value);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._formDisabled.set(isDisabled);
  }

  /** One segment's current state, in the terms the locale renders it in. */
  private describe(
    kind: TimeSegmentKind,
    layout: TimeLayout,
  ): Omit<TimeSegment, 'separator'> {
    if (kind === 'dayPeriod') {
      const period = this._period();
      return {
        kind,
        text: layout.dayPeriods[period],
        value: period === 'am' ? 0 : 1,
        min: 0,
        max: 1,
        label: SEGMENT_LABEL[kind],
      };
    }

    const bounds = segmentBounds(kind, layout.hour12);
    const raw = this.rawOf(kind);
    const shown = raw === null ? null : this.toShown(kind, raw, layout);

    return {
      kind,
      text: shown === null ? '' : segmentDisplay(shown, kind, layout),
      value: shown ?? bounds.min,
      min: bounds.min,
      max: bounds.max,
      label: SEGMENT_LABEL[kind],
    };
  }

  private rawOf(kind: TimeSegmentKind): number | null {
    if (kind === 'hour') return this._hours();
    if (kind === 'minute') return this._minutes();
    return this._seconds();
  }

  private toShown(kind: TimeSegmentKind, raw: number, layout: TimeLayout): number {
    return kind === 'hour' ? displayHour(raw, layout.hour12) : raw;
  }

  private apply(kind: TimeSegmentKind, shown: number): void {
    if (kind === 'hour') {
      this._hours.set(hoursFromDisplay(shown, this._period(), this.layout().hour12));
    } else if (kind === 'minute') {
      this._minutes.set(shown);
    } else {
      this._seconds.set(shown);
    }
    this.commit();
  }

  private clear(kind: TimeSegmentKind): void {
    if (kind === 'hour') this._hours.set(null);
    else if (kind === 'minute') this._minutes.set(null);
    else this._seconds.set(0);
    this.commit();
  }

  /**
   * Show a value without emitting.
   *
   * The split between this and {@link commit} is what keeps a form writing in
   * from looking like a user typing — Risk R-3.
   */
  private render(value: string | null): void {
    /*
     * A value the segments already represent is not a write to render.
     *
     * Without this, typing an hour and no minute wipes the hour: the commit
     * emits `null` (an hour alone is not a time), `value` becomes `null`, and
     * the effect renders that `null` straight back over the digit that was
     * just typed. Comparing against what the segments would emit tells an
     * echo of our own commit apart from a form genuinely clearing the field.
     */
    if (value === this.asValue()) return;

    const parts = parseTimeValue(value);
    if (parts === null) {
      this._hours.set(null);
      this._minutes.set(null);
      this._seconds.set(0);
      return;
    }

    this._hours.set(parts.hours);
    this._minutes.set(parts.minutes);
    this._seconds.set(parts.seconds);
    this._period.set(dayPeriodFor(parts.hours));
  }

  /**
   * The one path a user-driven change takes.
   *
   * An hour with no minute is not a time, so the value stays `null` until both
   * are set — the same rule `<input type="time">` follows. Anything else lets
   * a form submit half a reading.
   */
  private commit(): void {
    const next = this.asValue();
    this.onChange(next);
    this.value.set(next);
  }

  /** What the segments currently add up to, or `null` if they are incomplete. */
  private asValue(): string | null {
    const hours = this._hours();
    const minutes = this._minutes();
    if (hours === null || minutes === null) return null;
    return formatTimeValue({ hours, minutes, seconds: this._seconds() }, this.withSeconds());
  }
}
