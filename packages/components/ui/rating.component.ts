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
import { cn, isRtl } from '../lib/utils';
import { isTouchDevice } from '../lib/touch';

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
  template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'rating'"
      [attr.data-readonly]="readonly() || null"
      [attr.data-disabled]="isDisabled() || null"
      style="touch-action: none"
      role="slider"
      [attr.aria-valuenow]="value()"
      [attr.aria-valuemin]="0"
      [attr.aria-valuemax]="max()"
      [attr.aria-label]="ariaLabel()"
      [attr.tabindex]="isDisabled() || readonly() ? -1 : 0"
      (keydown)="onKeydown($event)"
      (mouseleave)="onMouseLeave()"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd($event)"
    >
      @for (star of stars(); track star.index) {
        <button
          type="button"
          [class]="starClasses(star)"
          [attr.aria-label]="'Rate ' + (star.index + 1) + ' out of ' + max()"
          [disabled]="isDisabled() || readonly()"
          (mousemove)="onStarHover($event, star.index)"
          (click)="onStarClick($event, star.index)"
        >
          @if (getStarFill(star) === 'full') {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-5 w-5"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          } @else if (getStarFill(star) === 'half') {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              class="h-5 w-5"
            >
              <defs>
                <linearGradient [id]="'half-' + star.index">
                  @if (isRtl()) {
                    <stop offset="50%" stop-color="transparent"/>
                    <stop offset="50%" stop-color="currentColor"/>
                  } @else {
                    <stop offset="50%" stop-color="currentColor"/>
                    <stop offset="50%" stop-color="transparent"/>
                  }
                </linearGradient>
              </defs>
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                [attr.fill]="'url(#half-' + star.index + ')'"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          } @else {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-5 w-5"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          }
        </button>
      }
    </div>
  `,
  host: { class: 'inline-flex' },
})
export class RatingComponent implements ControlValueAccessor {
  max = input(5);
  precision = input<0.5 | 1>(1);
  readonly = input(false);
  disabled = input(false);
  class = input('');
  ariaLabel = input('Rating');
  size = input<'sm' | 'md' | 'lg'>('md');

  ratingChange = output<number>();

  value = signal(0);
  hoverValue = signal<number | null>(null);
  private readonly formDisabled = signal(false);

  private onChange: (value: number) => void = () => { };
  private onTouched: () => void = () => { };

  private readonly el = inject(ElementRef);

  isRtl() {
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

  starClasses(star: { index: number; value: number }) {
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

  onStarHover(event: MouseEvent, index: number) {
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

  onMouseLeave() {
    if (isTouchDevice()) return;
    this.hoverValue.set(null);
  }

  onTouchMove(event: TouchEvent) {
    if (this.isDisabled() || this.readonly()) return;
    event.preventDefault();

    const touch = event.touches[0];
    const ratingValue = this.getRatingFromPoint(touch.clientX, touch.clientY);
    if (ratingValue !== null) {
      this.hoverValue.set(ratingValue);
    }
  }

  onTouchEnd(event: TouchEvent) {
    if (this.isDisabled() || this.readonly()) return;
    event.preventDefault();

    const currentHover = this.hoverValue();
    this.hoverValue.set(null);

    if (currentHover !== null) {
      const finalValue = this.value() === currentHover ? 0 : currentHover;
      this.setValue(finalValue);
    }
  }

  onStarClick(event: MouseEvent, index: number) {
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

  onKeydown(event: KeyboardEvent) {
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

  private getRatingFromPoint(clientX: number, clientY: number): number | null {
    const container = this.el.nativeElement.querySelector('[data-slot="rating"]') as HTMLElement | null;
    if (!container) return null;

    const buttons = container.querySelectorAll('button');
    for (let i = 0; i < buttons.length; i++) {
      const rect = buttons[i].getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        if (this.precision() === 0.5) {
          const x = clientX - rect.left;
          const isFirstHalf = this.isRtl() ? x > rect.width / 2 : x < rect.width / 2;
          return i + (isFirstHalf ? 0.5 : 1);
        }
        return i + 1;
      }
    }
    return null;
  }

  private setValue(val: number) {
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
