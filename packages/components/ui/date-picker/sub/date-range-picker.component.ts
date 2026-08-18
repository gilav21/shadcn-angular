import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  forwardRef,
  effect,
  ElementRef,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../../lib/utils';
import type { TopLayerHandle } from '../../../lib/top-layer';
import { CalendarComponent, DateRange, TimeRange } from '../../calendar';
import { DEFAULT_POPUP_POSITION, calculatePopupPosition, computePopupClasses, computePopupStyles, promotePopup, PopupPosition } from '../date-picker.component';

/**
 * DateRangePickerComponent - For selecting a date range
 *
 * Usage:
 * <ui-date-range-picker (rangeChange)="onRangeChange($event)" />
 */
@Component({
  selector: 'ui-date-range-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateRangePickerComponent),
      multi: true,
    },
  ],
  templateUrl: './date-range-picker.component.html',
  styleUrl: './date-range-picker.component.css',
  host: {
    class: 'contents',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class DateRangePickerComponent implements ControlValueAccessor, OnDestroy {
  /** Merged onto the trigger button, whose default width is `w-full sm:w-[300px]` (wider than the single picker, to fit two formatted dates). The popup is unaffected. */
  readonly class = input('');
  /** Muted text on the trigger while no start date is chosen. Once only a start exists the label becomes `<start> - ...`; with both it is `<start> - <end>`. */
  readonly placeholder = input('Pick a date range');
  /** Disables the trigger and makes {@link toggleOpen} a no-op. Driven only by this input — {@link setDisabledState} ignores `control.disable()`. */
  readonly disabled = input(false);
  /**
   * Adds the calendar's start/end time selectors (reported through
   * {@link timeRangeChange}, kept separate from the dates) and appends 2-digit
   * hours and minutes to both trigger labels. It also suppresses the
   * auto-close once both ends are picked, so the times can still be set.
   */
  readonly showTime = input(false);
  /** BCP 47 tag passed to the calendar and to `toLocaleDateString` for both trigger labels — it selects month/day names and field order, not a timezone. */
  readonly locale = input('en');

  readonly isOpen = signal(false);
  readonly rangeValue = signal<DateRange>({ start: null, end: null });
  readonly timeRange = signal<TimeRange>({ start: '', end: '' });
  /**
   * Emits the range on every calendar click — including the half-finished
   * `{ start, end: null }` state after the first click — so a consumer must
   * check `end` before treating it as a complete range. Fires alongside the
   * `ControlValueAccessor` change callback.
   */
  readonly rangeChange = output<DateRange>();
  /** Emits the `HH:mm` start/end times when {@link showTime} is on. Times are tracked separately from {@link rangeChange} and are never merged into the `Date` objects. */
  readonly timeRangeChange = output<TimeRange>();

  private onChange: (value: DateRange) => void = () => { };
  private onTouched: () => void = () => { };

  @ViewChild('popupEl') popupEl?: ElementRef<HTMLElement>;
  @ViewChild('triggerEl') triggerEl?: ElementRef<HTMLElement>;

  private readonly adjustedPosition = signal<PopupPosition>({ ...DEFAULT_POPUP_POSITION });

  private topLayer: TopLayerHandle | null = null;

  constructor() {
    effect(() => {
      if (!this.isOpen()) {
        this.releasePopup();
        return;
      }
      this.adjustedPosition.set({ offsetX: 0, actualSide: 'bottom' });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.positionPopup();
        });
      });
    });
  }

  /** Releases the top-layer promotion when the component is torn down while open. */
  ngOnDestroy(): void {
    this.releasePopup();
  }

  readonly buttonClasses = computed(() => cn(
    'inline-flex w-full sm:w-[300px] items-center justify-start rounded-md border border-input bg-background text-sm font-normal ring-offset-background',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    this.class()
  ));

  readonly popupClasses = computed(() => computePopupClasses(this.adjustedPosition()));

  readonly popupStyles = computed(() => computePopupStyles(this.adjustedPosition()));

  /**
   * Promotes the open panel into the top layer, where the helper's own
   * flip/clamp logic positions it, and only falls back to
   * {@link calculatePopupPosition} when the promotion did not happen.
   */
  private positionPopup(): void {
    const panel = this.popupEl?.nativeElement;
    const anchor = this.triggerEl?.nativeElement;
    if (!panel) return;
    this.releasePopup();
    if (anchor) {
      const handle = promotePopup(panel, anchor);
      if (handle.promoted) {
        this.topLayer = handle;
        return;
      }
    }
    this.adjustedPosition.set(calculatePopupPosition(panel));
  }

  private releasePopup(): void {
    this.topLayer?.release();
    this.topLayer = null;
  }

  /** Opens or closes the calendar popup (the trigger's click handler); ignored while {@link disabled}. Opening re-runs the flip/shift positioning against the viewport. */
  toggleOpen(): void {
    if (this.disabled()) return;
    this.isOpen.update(v => !v);
  }

  /**
   * Calendar `selectedChange` handler: stores the range, emits
   * {@link rangeChange}, notifies the form control and marks it touched. Values
   * that are not a `{ start, end }` object are ignored outright — the existing
   * range is kept rather than cleared. The popup closes only once both ends are
   * set and {@link showTime} is off.
   */
  onRangeSelect(value: unknown): void {
    if (value && typeof value === 'object' && 'start' in value) {
      const range = value as DateRange;
      this.rangeValue.set(range);
      this.rangeChange.emit(range);
      this.onChange(range);
      this.onTouched();

      if (range.start && range.end && !this.showTime()) {
        this.isOpen.set(false);
      }
    }
  }

  /** Calendar time-selector handler: stores the times and re-emits them via {@link timeRangeChange}. It does not touch the dates, the form value, or the popup's open state. */
  onTimeRangeChange(range: TimeRange): void {
    this.timeRange.set(range);
    this.timeRangeChange.emit(range);
  }

  /**
   * Document-level click-outside dismissal, bound on the host. Any click whose
   * target is not inside `[data-slot="date-range-picker"]` closes the popup;
   * clicks within the calendar stop propagating first. A half-picked range
   * survives the close and can be finished on reopen.
   */
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-slot="date-range-picker"]')) {
      this.isOpen.set(false);
    }
  }

  /**
   * Renders one end of the trigger label: short month, numeric day and year in
   * {@link locale}, plus 2-digit hour and minute when {@link showTime} is on.
   * The abbreviated month keeps both dates on one line; the single-date picker
   * uses the long month instead.
   */
  formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...(this.showTime() ? { hour: '2-digit', minute: '2-digit' } : {})
    };
    return date.toLocaleDateString(this.locale(), options);
  }

  /** `ControlValueAccessor`: sets both ends of the range; `null` resets to `{ start: null, end: null }` and restores the {@link placeholder}. Any times held for {@link timeRangeChange} are left as they were. */
  writeValue(value: DateRange | null): void {
    if (value) {
      this.rangeValue.set(value);
    } else {
      this.rangeValue.set({ start: null, end: null });
    }
  }

  /** `ControlValueAccessor`: the form value is the `DateRange` object only — never the times. It also fires for the intermediate `end: null` state, so validate completeness in the form. */
  registerOnChange(fn: (value: DateRange) => void): void {
    this.onChange = fn;
  }

  /** `ControlValueAccessor`: marked touched on the first date click, not on opening or blurring the trigger. */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** `ControlValueAccessor` no-op — bind the {@link disabled} input instead; `control.disable()` alone will not disable the trigger. */
  setDisabledState(_isDisabled: boolean): void {
    // Disabled state is managed via the disabled input binding
  }
}
