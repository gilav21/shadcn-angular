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
import { cn, getClippingRect } from '../../lib/utils';
import { anchorToTopLayer, type TopLayerAlign, type TopLayerHandle } from '../../lib/top-layer';
import { CalendarComponent } from '../calendar';
export { DateRangePickerComponent } from './sub/date-range-picker.component';

export type PopupPosition = { offsetX: number; actualSide: 'top' | 'bottom' };

export const DEFAULT_POPUP_POSITION: PopupPosition = { offsetX: 0, actualSide: 'bottom' };

export function calculatePopupPosition(element: HTMLElement): PopupPosition {
  const rect = element.getBoundingClientRect();
  const boundary = getClippingRect(element);

  let offsetX = 0;
  let actualSide: 'top' | 'bottom' = 'bottom';

  if (rect.right > boundary.right) {
    offsetX = boundary.right - rect.right - 8;
  } else if (rect.left < boundary.left) {
    offsetX = boundary.left - rect.left + 8;
  }

  const overflowBottom = rect.bottom - boundary.bottom;
  const parentEl = element.parentElement;
  const parentRect = parentEl?.getBoundingClientRect();
  const spaceAbove = parentRect ? parentRect.top - boundary.top : 0;
  const spaceBelow = parentRect ? boundary.bottom - parentRect.bottom : 0;

  if (overflowBottom > 0) {
    actualSide = spaceAbove > spaceBelow ? 'top' : 'bottom';
  }

  return { offsetX, actualSide };
}

export function computePopupClasses(position: PopupPosition): string {
  const sideClasses = {
    top: 'bottom-full mb-1',
    bottom: 'top-full mt-1',
  };
  return cn(
    'absolute ltr:left-0 rtl:right-0 z-50 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-0 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
    sideClasses[position.actualSide]
  );
}

export function computePopupStyles(position: PopupPosition): string {
  if (position.offsetX !== 0) {
    return `transform: translateX(${position.offsetX}px);`;
  }
  return '';
}

/**
 * Which edge of the trigger the popup lines up with, honouring the writing
 * direction: the panel is start-aligned, which is the trigger's right edge in
 * RTL — the same thing the `ltr:left-0 rtl:right-0` fallback classes do.
 */
export function popupAlign(anchor: HTMLElement): TopLayerAlign {
  return getComputedStyle(anchor).direction === 'rtl' ? 'end' : 'start';
}

/**
 * Promote the calendar panel into the top layer so it escapes any
 * `overflow: hidden` ancestor (a card, an accordion panel, a scroll area).
 * A `z-index` cannot do this. The returned handle's `release()` must be called
 * when the popup closes; a handle with `promoted: false` means the panel was
 * left alone and the `absolute` fallback positioning still applies.
 */
export function promotePopup(panel: HTMLElement, anchor: HTMLElement): TopLayerHandle {
  return anchorToTopLayer(panel, anchor, { gap: 4, side: 'bottom', align: popupAlign(anchor) });
}

/**
 * DatePickerComponent - A date selection component combining Popover and Calendar
 * 
 * Usage:
 * <ui-date-picker [(date)]="selectedDate" placeholder="Select a date" />
 * <ui-date-picker [showTime]="true" placeholder="Pick date & time" />
 * 
 * Or with reactive forms:
 * <ui-date-picker formControlName="birthDate" />
 */
@Component({
  selector: 'ui-date-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
  host: {
    class: 'contents',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class DatePickerComponent implements ControlValueAccessor, OnDestroy {
  /** Merged onto the trigger button, whose default width is `w-full sm:w-[240px]` — use it to widen/narrow the field or restyle the border. The popup is unaffected. */
  readonly class = input('');
  /** Muted text shown on the trigger while no date is selected; replaced by {@link formatDate} output once there is one. */
  readonly placeholder = input('Pick a date');
  /** Disables the trigger button and makes {@link toggleOpen} a no-op. Driven only by this input — {@link setDisabledState} ignores `control.disable()`. */
  readonly disabled = input(false);
  /**
   * Adds the calendar's time-of-day selector and includes 2-digit hours and
   * minutes in the trigger label. Also changes dismissal: with time on, picking
   * a day keeps the popup open so the time can still be set, instead of closing
   * on selection (see {@link onDateSelect}).
   */
  readonly showTime = input(false);
  /** BCP 47 tag passed to the calendar and to `toLocaleDateString` for the trigger label — it selects month/day names and field order, not a timezone. */
  readonly locale = input('en');
  /**
   * Initial/externally-set date, for `[(date)]` two-way binding with
   * {@link dateChange}. Pushing `null` clears the selection back to the
   * {@link placeholder}; only the initial `null` default is ignored, so a
   * date written through a form control is not clobbered on first render.
   */
  readonly date = input<Date | null>(null);
  /** Emits on every calendar selection (the `[(date)]` half). Fires alongside the `ControlValueAccessor` change callback, so forms and two-way binding stay in sync. */
  readonly dateChange = output<Date | null>();

  readonly isOpen = signal(false);
  readonly internalValue = signal<Date | null>(null);
  private onChange: (value: Date | null) => void = () => { };
  private onTouched: () => void = () => { };

  @ViewChild('popupEl') popupEl?: ElementRef<HTMLElement>;
  @ViewChild('triggerEl') triggerEl?: ElementRef<HTMLElement>;

  private readonly adjustedPosition = signal<PopupPosition>({ ...DEFAULT_POPUP_POSITION });

  private topLayer: TopLayerHandle | null = null;

  private isFirstDateInput = true;

  constructor() {
    effect(() => {
      const dateInput = this.date();
      const isInitialRun = this.isFirstDateInput;
      this.isFirstDateInput = false;
      if (dateInput === null && isInitialRun) return;
      this.internalValue.set(dateInput);
    });
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
    'inline-flex w-full sm:w-[240px] items-center justify-start rounded-md border border-input bg-background text-sm font-normal ring-offset-background',
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
    if (!this.disabled()) {
      this.isOpen.update(v => !v);
    }
  }

  /**
   * Calendar `selectedChange` handler: stores the date, emits
   * {@link dateChange}, notifies the form control, and marks it touched.
   * Anything that is not a `Date` is normalised to `null` (a cleared
   * selection). The popup closes here unless {@link showTime} is set.
   */
  onDateSelect(value: unknown): void {
    let selectedDate: Date | null = null;
    if (value instanceof Date) {
      selectedDate = value;
    }
    this.internalValue.set(selectedDate);
    this.dateChange.emit(selectedDate);
    this.onChange(selectedDate);
    this.onTouched();
    if (!this.showTime()) {
      this.isOpen.set(false);
    }
  }

  /**
   * Document-level click-outside dismissal, bound on the host. Any click whose
   * target is not inside `[data-slot="date-picker"]` closes the popup; clicks
   * within the calendar stop propagating before they reach here. Closing this
   * way does not touch the selected value.
   */
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-slot="date-picker"]')) {
      this.isOpen.set(false);
    }
  }

  /**
   * Renders the trigger label: long month, numeric day and year in
   * {@link locale}, plus 2-digit hour and minute when {@link showTime} is on.
   * Exposed so a host template can reuse the exact same label formatting.
   */
  formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(this.showTime() ? { hour: '2-digit', minute: '2-digit' } : {})
    };
    return date.toLocaleDateString(this.locale(), options);
  }

  /** `ControlValueAccessor`: sets the displayed date. Unlike the {@link date} input this *does* accept `null`, which clears the selection back to the {@link placeholder}. */
  writeValue(value: Date | null): void {
    this.internalValue.set(value);
  }

  /** `ControlValueAccessor`: the callback fires on each calendar selection, with the same value as {@link dateChange}. */
  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }

  /** `ControlValueAccessor`: marked touched on the first selection, not on opening or blurring the trigger. */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** `ControlValueAccessor` no-op — bind the {@link disabled} input instead; `control.disable()` alone will not disable the trigger. */
  setDisabledState(_isDisabled: boolean): void {
    // Disabled state is managed via the disabled input binding
  }
}

