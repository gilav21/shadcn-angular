import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  forwardRef,
  output,
  inject,
  ElementRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn, isRtl } from '../../lib/utils';
import { createLocaleBindings, interpolate, type LocaleInput } from '../../lib/i18n';
import { RATING_LOCALES, type RatingLocale } from './rating.locales';
import { isTouchDevice } from '../../lib/touch';

@Component({
  selector: 'ui-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RatingComponent),
      multi: true,
    },
  ],
  templateUrl: './rating.component.html',
  host: { class: 'inline-flex' },
})
export class RatingComponent implements ControlValueAccessor {
  /** Number of stars rendered, and the ceiling for the value (`End` sets it). Defaults to 5. */
  readonly max = input(5);
  /**
   * Smallest step the user can pick: `1` (default) whole stars, or `0.5` half stars.
   * With `0.5` the half is chosen from the pointer's position within the star —
   * mirrored under RTL — and arrow keys move in half steps.
   */
  readonly precision = input<0.5 | 1>(1);
  /** Display-only mode: keeps full opacity but drops pointer events and key handling, unlike {@link disabled}. */
  readonly readonly = input(false);
  /**
   * Blocks interaction and dims the group. OR-ed with the state pushed by a
   * `FormControl` through `setDisabledState`, so a form-disabled control stays
   * disabled even with this `false`.
   */
  readonly disabled = input(false);
  /** Extra classes merged onto the star row (`inline-flex items-center gap-0.5`). */
  readonly class = input('');
  /** Override for the group `aria-label`. Falls back to the locale's `rating`. */
  readonly ariaLabel = input<string>();
  /**
   * Size of each star — `sm` 16px, `md` 20px (default), `lg` 24px. Scales the
   * button box and the star glyph inside it together, so the glyph is never
   * clipped by a smaller box nor adrift in a larger one.
   */
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<RatingLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, RATING_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;
  /** Effective `aria-label` on the rating group — explicit input wins; otherwise the locale's `rating`. */
  readonly resolvedAriaLabel = computed(() => this.ariaLabel() ?? this.t().rating);
  /** Per-star `aria-label`, interpolated from the locale's `rateAriaLabel`. */
  starAriaLabel(starValue: number): string {
    return interpolate(this.t().rateAriaLabel ?? 'Rate {n} out of {total}', {
      n: starValue,
      total: this.max(),
    });
  }

  /**
   * Emits the committed rating on click, touch-end or key press — never on hover.
   * Re-picking the current value emits `0` (the clear gesture), and the same
   * value is pushed to the `ControlValueAccessor` at the same time.
   */
  ratingChange = output<number>();

  value = signal(0);
  hoverValue = signal<number | null>(null);
  private readonly formDisabled = signal(false);

  private onChange: (value: number) => void = () => { };
  private onTouched: () => void = () => { };

  private readonly el = inject(ElementRef);

  /**
   * Resolves text direction from the host's computed style rather than an input, so
   * an ancestor `dir="rtl"` is honoured. Drives half-star hit-testing and swaps the
   * arrow keys in {@link onKeydown}.
   */
  isRtl(): boolean {
    return isRtl(this.el.nativeElement);
  }
  isDisabled = computed(() => this.disabled() || this.formDisabled());
  displayValue = computed(() => this.hoverValue() ?? this.value());

  stars = computed(() => {
    const count = this.max();
    return Array.from({ length: count }, (_, i) => ({
      index: i,
      value: i + 1,
    }));
  });

  classes = computed(() =>
    cn(
      'inline-flex items-center gap-0.5',
      this.isDisabled() && 'opacity-50 cursor-not-allowed',
      this.readonly() && 'pointer-events-none',
      this.class()
    )
  );

  /**
   * Box dimensions for one star, from {@link size}. Applied to both the button
   * and the SVG inside it so the glyph always fills its box exactly.
   */
  readonly glyphClasses = computed(() => {
    const size = this.size();
    if (size === 'sm') return 'h-4 w-4';
    if (size === 'lg') return 'h-6 w-6';
    return 'h-5 w-5';
  });

  /**
   * Classes for one star button — {@link size} box dimensions plus the amber/muted colour
   * chosen from {@link getStarFill}. The hover-grow affordance is dropped while
   * disabled or readonly.
   */
  starClasses(star: { index: number; value: number }): string {
    const fill = this.getStarFill(star);
    return cn(
      'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
      this.glyphClasses(),
      fill === 'empty' ? 'text-muted-foreground/30' : 'text-yellow-400',
      !this.isDisabled() && !this.readonly() && 'cursor-pointer hover:scale-110'
    );
  }

  /**
   * Fill state to render for one star, computed against the hover preview when the
   * pointer is over the group and the committed value otherwise. `'half'` is only
   * ever returned when {@link precision} is `0.5`, so a fractional model value on a
   * whole-star rating rounds *down* to `'empty'`.
   */
  getStarFill(star: { index: number; value: number }): 'full' | 'half' | 'empty' {
    const current = this.displayValue();
    if (current >= star.value) {
      return 'full';
    }
    if (this.precision() === 0.5 && current >= star.value - 0.5) {
      return 'half';
    }
    return 'empty';
  }

  /**
   * Starts a touch drag on a star: previews the whole-star value under the finger and
   * calls `preventDefault()` to suppress the synthetic mouse events that would
   * otherwise double-fire {@link onStarClick}. Half stars are not reachable on the
   * initial touch — drag first, since {@link onTouchMove} does the fine hit-testing.
   */
  onStarTouchStart(event: TouchEvent, index: number): void {
    if (this.isDisabled() || this.readonly()) return;
    event.preventDefault();
    this.hoverValue.set(index + 1);
  }

  /**
   * Updates the hover preview only — the committed value is untouched until a click.
   * Skipped entirely on touch devices so a tap's synthetic mousemove cannot leave a
   * stale preview behind.
   */
  onStarHover(event: MouseEvent, index: number): void {
    if (isTouchDevice()) return;
    if (this.isDisabled() || this.readonly()) return;

    if (this.precision() === 0.5) {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const width = rect.width;
      const isFirstHalf = this.isRtl() ? x > width / 2 : x < width / 2;
      this.hoverValue.set(index + (isFirstHalf ? 0.5 : 1));
    } else {
      this.hoverValue.set(index + 1);
    }
  }

  /** Clears the hover preview so the stars fall back to the committed value. No-op on touch devices. */
  onMouseLeave(): void {
    if (isTouchDevice()) return;
    this.hoverValue.set(null);
  }

  /**
   * Tracks a finger sliding across the row, previewing the star nearest the touch X
   * (and its half, when {@link precision} is `0.5`). Bound on the container rather
   * than each star, so the drag keeps working past the star it started on. Scrolling
   * is suppressed for the duration.
   */
  onTouchMove(event: TouchEvent): void {
    if (this.isDisabled() || this.readonly()) return;
    event.preventDefault();

    const touch = event.touches[0];
    const ratingValue = this.getRatingFromPoint(touch.clientX);
    if (ratingValue !== null) {
      this.hoverValue.set(ratingValue);
    }
  }

  /**
   * Commits the previewed value when the finger lifts and clears the preview.
   * Lifting on the already-selected value clears the rating to `0`, matching the
   * click gesture in {@link onStarClick}.
   */
  onTouchEnd(event: TouchEvent): void {
    if (this.isDisabled() || this.readonly()) return;
    event.preventDefault();

    const currentHover = this.hoverValue();
    this.hoverValue.set(null);

    if (currentHover !== null) {
      const finalValue = this.value() === currentHover ? 0 : currentHover;
      this.setValue(finalValue);
    }
  }

  /**
   * Commits the clicked value, taking the half from the click's offset inside the star
   * when {@link precision} is `0.5` (mirrored under RTL). Clicking the current value
   * clears the rating to `0`, so there is a mouse-only path back to "unrated".
   */
  onStarClick(event: MouseEvent, index: number): void {
    if (this.isDisabled() || this.readonly()) return;

    let newValue: number;
    if (this.precision() === 0.5) {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const width = rect.width;
      const isFirstHalf = this.isRtl() ? x > width / 2 : x < width / 2;
      newValue = index + (isFirstHalf ? 0.5 : 1);
    } else {
      newValue = index + 1;
    }

    const finalValue = this.value() === newValue ? 0 : newValue;
    this.setValue(finalValue);
  }

  /**
   * Keyboard control, bound to the visually-hidden `<input type="range">` that carries
   * the group's focus and `aria-label`: arrows step by {@link precision} (left/right are
   * swapped under RTL, up/down never are), `Home` clears to `0` and `End` jumps to
   * {@link max}. Values are clamped to `0…max`, every accepted key commits
   * immediately, and unhandled keys bubble untouched.
   */
  onKeydown(event: KeyboardEvent): void {
    if (this.isDisabled() || this.readonly()) return;

    const step = this.precision();
    let newValue = this.value();

    const incrementKey = this.isRtl() ? 'ArrowLeft' : 'ArrowRight';
    const decrementKey = this.isRtl() ? 'ArrowRight' : 'ArrowLeft';

    switch (event.key) {
      case incrementKey:
      case 'ArrowUp':
        event.preventDefault();
        newValue = Math.min(this.max(), newValue + step);
        break;
      case decrementKey:
      case 'ArrowDown':
        event.preventDefault();
        newValue = Math.max(0, newValue - step);
        break;
      case 'Home':
        event.preventDefault();
        newValue = 0;
        break;
      case 'End':
        event.preventDefault();
        newValue = this.max();
        break;
      default:
        return;
    }

    this.setValue(newValue);
  }

  private getRatingFromPoint(clientX: number): number | null {
    const container = this.el.nativeElement.querySelector('[data-slot="rating"]') as HTMLElement | null;
    if (!container) return null;

    const buttons = container.querySelectorAll('button');
    if (buttons.length === 0) return null;

    let closestIndex = -1;
    let closestDist = Infinity;

    for (let i = 0; i < buttons.length; i++) {
      const rect = buttons[i].getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const dist = Math.abs(clientX - centerX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }

    if (closestIndex < 0) return null;

    if (this.precision() === 0.5) {
      const rect = buttons[closestIndex].getBoundingClientRect();
      const x = clientX - rect.left;
      const isFirstHalf = this.isRtl() ? x > rect.width / 2 : x < rect.width / 2;
      return closestIndex + (isFirstHalf ? 0.5 : 1);
    }
    return closestIndex + 1;
  }

  private setValue(val: number): void {
    this.value.set(val);
    this.onChange(val);
    this.onTouched();
    this.ratingChange.emit(val);
  }

  /**
   * `ControlValueAccessor` — adopts the form value, coercing `null`/`undefined` to `0`.
   * Values above {@link max} are not clamped and simply light every star.
   */
  writeValue(value: number): void {
    this.value.set(value ?? 0);
  }

  /** `ControlValueAccessor` — registers the change callback, invoked alongside {@link ratingChange}. */
  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  /**
   * `ControlValueAccessor` — registers the touched callback. It fires on value commit
   * rather than on blur, so the control is marked touched only once a rating is picked.
   */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /**
   * `ControlValueAccessor` — records the form's disabled state in a separate signal so
   * it cannot be undone by the {@link disabled} input; either source disables the group.
   */
  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  /** Current rating as a string, so a template reference can be interpolated directly. */
  toString(): string {
    return String(this.value());
  }
}
