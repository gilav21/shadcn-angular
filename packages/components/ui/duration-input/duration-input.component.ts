import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import {
  LEADING_WIDTH,
  SEGMENT_WIDTH,
  fromParts,
  segmentMax,
  segmentText,
  toParts,
  type DurationParts,
  type DurationUnit,
} from './duration-input.format';

const durationInputWrapperVariants = cva(
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

export type DurationInputVariant = 'outline' | 'underline' | 'ghost';

/** One editable segment, as the template renders it. */
export interface DurationSegment {
  readonly unit: DurationUnit;
  readonly value: number;
  readonly text: string;
  readonly isLeading: boolean;
  readonly max: number;
  readonly label: string;
  /** Width in `ch`, sized to this segment's own digits. */
  readonly width: number;
}

/** The leading segment is unpadded; every following one is two digits wide. */
function widthFor(index: number): number {
  return index === 0 ? LEADING_WIDTH : SEGMENT_WIDTH;
}

/**
 * How wide a segment's box needs to be, in `ch`.
 *
 * Sized to the digits it actually holds, because the leading segment has no
 * fixed width: it absorbs everything above it, so it may hold `5400` as
 * readily as `1`. Leaving it `auto` is what a text input does *not* handle —
 * an input with no width falls back to its `size` attribute, which defaults to
 * **20 characters**, so a one-digit hour rendered a 181px box.
 *
 * The `+ 1` is breathing room so the caret has somewhere to sit past the last
 * digit.
 */
function boxWidth(text: string, placeholder: string): number {
  return Math.max(2, text.length, placeholder.length) + 1;
}

/** Which way an arrow key moves a segment; 0 for a key this control ignores. */
function stepFor(key: string): number {
  if (key === 'ArrowUp') return 1;
  if (key === 'ArrowDown') return -1;
  return 0;
}

/** How a unit is named to a screen reader. */
const UNIT_LABEL: Record<DurationUnit, string> = {
  hours: 'hours',
  minutes: 'minutes',
  seconds: 'seconds',
};

/**
 * A length of time, edited one unit at a time.
 *
 * ### The value is seconds
 *
 * Not milliseconds and not an ISO-8601 string — see
 * `specs/form-controls-small-spec.md` §3.2. `formatIso8601` and `parseIso8601`
 * ship alongside for APIs that speak it.
 *
 * ### Why segments rather than one text field
 *
 * A single field has to guess what `130` means, and every guess is wrong for
 * somebody. Separate segments make the question unnecessary: the caret is in
 * the minutes box, so the digits are minutes. It is also how
 * `<input type="time">` behaves, which means the muscle memory already exists.
 *
 * Only the leading segment is unbounded. Minutes under an hours segment stop
 * at 59 because sixty of them are an hour — but a field showing minutes alone
 * must allow 90, or a ninety-minute duration could not be typed at all.
 *
 * ### A fieldset, and a numeric keypad without a number field
 *
 * The segments are a named group of related controls, which is what a
 * fieldset *is* — so the grouping is carried by a native element rather than
 * by an ARIA role bolted onto a div. Focus is watched with the bubbling
 * focusout event rather than blur, because blur does not bubble and moving
 * between two segments is not leaving the control.
 *
 * Each segment is a text field that declares a numeric input mode rather than
 * a number field: a number field brings spinner arrows that would sit inside
 * every segment, and accepts `e`, `+` and `-`, none of which belong in a
 * duration.
 */
@Component({
  selector: 'ui-duration-input',
  exportAs: 'uiDurationInput',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DurationInputComponent),
      multi: true,
    },
  ],
  templateUrl: './duration-input.component.html',
  styleUrl: './duration-input.component.css',
  host: { class: 'contents' },
})
export class DurationInputComponent implements ControlValueAccessor {
  /**
   * The duration in seconds. `null` shows empty segments.
   *
   * A `model()` named exactly `value` is what makes this a valid Signal Forms
   * `FormValueControl`, and it doubles as the `valueChange` output.
   */
  readonly value = model<number | null>(null);

  /**
   * Which units to show, largest first.
   *
   * The largest one absorbs everything above it, so `['minutes','seconds']`
   * renders 90 minutes as `90:00` rather than silently dropping an hour.
   */
  readonly units = input<readonly DurationUnit[]>(['hours', 'minutes']);
  /** OR-ed with the state a reactive form pushes via `setDisabledState`. */
  readonly disabled = input<boolean>(false);
  /** Accessible name for the group of segments. */
  readonly ariaLabel = input<string>('Duration');
  /** Extra classes merged onto the wrapper. */
  readonly class = input('');
  /** Visual style of the wrapper: `outline`, `underline` or `ghost`. */
  readonly variant = input<DurationInputVariant>('outline');

  private readonly _currentValue = signal<number | null>(null);
  private readonly _formDisabled = signal(false);

  readonly isDisabled = computed(() => this.disabled() || this._formDisabled());

  readonly segments = computed<readonly DurationSegment[]>(() => {
    const units = this.units();
    const current = this._currentValue();
    const parts = toParts(current ?? 0, units);

    return units.map((unit, index) => {
      const text = current === null ? '' : segmentText(parts[unit], widthFor(index));
      const placeholder = index === 0 ? '0' : '00';

      return {
        unit,
        value: parts[unit],
        text,
        isLeading: index === 0,
        max: segmentMax(unit, index === 0),
        label: UNIT_LABEL[unit],
        width: boxWidth(text, placeholder),
      };
    });
  });

  /** What a screen reader hears for the whole control. */
  readonly valueText = computed(() => {
    const current = this._currentValue();
    if (current === null) return '';
    return this.segments()
      .filter(segment => segment.value > 0)
      .map(segment => `${segment.value} ${segment.label}`)
      .join(', ');
  });

  readonly wrapperClasses = computed(() =>
    cn(durationInputWrapperVariants({ variant: this.variant() }), this.class()),
  );

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    effect(() => {
      this._currentValue.set(this.value());
    });
  }

  /** Digits typed into one segment. Anything else is ignored, not rejected. */
  onSegmentInput(unit: DurationUnit, raw: string): void {
    const digits = raw.replace(/\D/g, '');
    if (digits === '') {
      this.setSegment(unit, 0);
      return;
    }
    this.setSegment(unit, Number.parseInt(digits, 10));
  }

  /** Arrow keys step the segment under the caret, as a spinbutton does. */
  onSegmentKeydown(unit: DurationUnit, event: KeyboardEvent): void {
    const step = stepFor(event.key);
    if (step === 0) return;

    event.preventDefault();
    const segment = this.segments().find(candidate => candidate.unit === unit);
    if (!segment) return;

    /*
     * Wraps rather than stopping, on a bounded segment only.
     *
     * Stepping 59 minutes up should read 0, not stay at 59 — the latter looks
     * like the control has stopped responding. The leading segment is
     * unbounded, so there is nothing to wrap around.
     */
    const next = segment.value + step;
    const wrapped = segment.isLeading
      ? Math.max(0, next)
      : ((next % (segment.max + 1)) + segment.max + 1) % (segment.max + 1);

    this.setSegment(unit, wrapped);
  }

  onBlur(): void {
    this.onTouched();
  }

  /** Renders a form value as-is, without emitting. */
  writeValue(value: number | null): void {
    this._currentValue.set(value);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._formDisabled.set(isDisabled);
  }

  private setSegment(unit: DurationUnit, next: number): void {
    const units = this.units();
    const parts = toParts(this._currentValue() ?? 0, units);
    const updated: DurationParts = { ...parts, [unit]: Math.max(0, next) };
    this.commit(fromParts(updated));
  }

  /**
   * The one path a user-driven change takes: store it, tell the form, then
   * publish through {@link value}, which emits `valueChange` exactly once.
   */
  private commit(value: number | null): void {
    this._currentValue.set(value);
    this.onChange(value);
    this.value.set(value);
  }
}
