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
  readonly max = input(5);
  readonly precision = input<0.5 | 1>(1);
  readonly readonly = input(false);
  readonly disabled = input(false);
  readonly class = input('');
  /** Override for the group `aria-label`. Falls back to the locale's `rating`. */
  readonly ariaLabel = input<string>();
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

  ratingChange = output<number>();

  value = signal(0);
  hoverValue = signal<number | null>(null);
  private readonly formDisabled = signal(false);

  private onChange: (value: number) => void = () => { };
  private onTouched: () => void = () => { };

  private readonly el = inject(ElementRef);

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

  starClasses(star: { index: number; value: number }): string {
    const fill = this.getStarFill(star);
    return cn(
      'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
      {
        'h-4 w-4': this.size() === 'sm',
        'h-5 w-5': this.size() === 'md',
        'h-6 w-6': this.size() === 'lg',
      },
      fill === 'empty' ? 'text-muted-foreground/30' : 'text-yellow-400',
      !this.isDisabled() && !this.readonly() && 'cursor-pointer hover:scale-110'
    );
  }

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

  onStarTouchStart(event: TouchEvent, index: number): void {
    if (this.isDisabled() || this.readonly()) return;
    event.preventDefault();
    this.hoverValue.set(index + 1);
  }

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

  onMouseLeave(): void {
    if (isTouchDevice()) return;
    this.hoverValue.set(null);
  }

  onTouchMove(event: TouchEvent): void {
    if (this.isDisabled() || this.readonly()) return;
    event.preventDefault();

    const touch = event.touches[0];
    const ratingValue = this.getRatingFromPoint(touch.clientX);
    if (ratingValue !== null) {
      this.hoverValue.set(ratingValue);
    }
  }

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

  writeValue(value: number): void {
    this.value.set(value ?? 0);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  toString(): string {
    return String(this.value());
  }
}
