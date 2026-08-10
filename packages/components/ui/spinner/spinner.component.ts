import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  viewChild,
  AfterViewInit,
  ElementRef,
} from '@angular/core';
import { cn } from '../../lib/utils';

type SpinnerSize = 'xs' | 'sm' | 'default' | 'lg' | 'xl' | 'page';
type SpinnerVariant = 'ring' | 'dots' | 'bars' | 'pulse';

const DOT_SIZE_MAP: Record<SpinnerSize, string> = {
  xs: 'h-1 w-1',
  sm: 'h-1.5 w-1.5',
  default: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
  xl: 'h-3 w-3',
  page: 'h-4 w-4',
};

const BAR_SIZE_MAP: Record<SpinnerSize, string> = {
  xs: 'w-0.5 h-3',
  sm: 'w-1 h-4',
  default: 'w-1 h-5',
  lg: 'w-1.5 h-6',
  xl: 'w-2 h-8',
  page: 'w-2.5 h-10',
};

const PULSE_SIZE_MAP: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  default: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  page: 'h-12 w-12',
};

const RING_SIZE_MAP: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  default: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  page: 'h-12 w-12',
};

/**
 * Spinner - Loading indicator with animated spinning icon
 *
 * Usage:
 * <ui-spinner />
 * <ui-spinner size="lg" />
 * <ui-spinner variant="dots" />
 * <ui-spinner variant="bars" size="xl" />
 * <ui-spinner variant="pulse" />
 * <ui-spinner [customSize]="48" />
 *
 * Custom loader via content projection:
 * <ui-spinner><my-custom-loader /></ui-spinner>
 *
 * Full page spinner:
 * <div class="fixed inset-0 flex items-center justify-center bg-background/80">
 *   <ui-spinner size="page" />
 * </div>
 */
@Component({
  selector: 'ui-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spinner.component.html',
  host: { class: 'contents' },
})
export class SpinnerComponent implements AfterViewInit {
  /** Extra classes merged onto the spinner element — `text-*` is the usual one, since every variant paints itself in `currentColor`. */
  readonly class = input('');
  /**
   * Preset scale. Each {@link variant} has its own size table, so `'lg'` means
   * a bigger ring, fatter bars or larger dots as appropriate. `'page'` is the
   * oversized step intended for a full-screen overlay (see
   * {@link PageSpinnerComponent}). Overridden by {@link customSize}.
   */
  readonly size = input<SpinnerSize>('default');
  /** Exact pixel size, applied inline and taking precedence over {@link size}. Use it when the spinner must match a specific control's height. `null` keeps the preset. */
  readonly customSize = input<number | null>(null);
  /**
   * Animation style: `'ring'` a spinning arc, `'dots'` three bouncing dots,
   * `'bars'` five staggered bars, `'pulse'` a single pulsing disc. Ignored
   * entirely when custom content is projected — the projected loader is then
   * rendered instead.
   */
  readonly variant = input<SpinnerVariant>('ring');

  readonly contentWrapper = viewChild<ElementRef>('contentWrapper');

  private readonly _hasCustomContent = signal(false);
  readonly hasCustomContent = this._hasCustomContent.asReadonly();

  readonly barDelays = ['0s', '0.1s', '0.2s', '0.3s', '0.4s'];

  protected readonly cn = cn;

  ngAfterViewInit(): void {
    this._hasCustomContent.set(
      (this.contentWrapper()?.nativeElement?.children?.length ?? 0) > 0
    );
  }

  readonly classes = computed(() => {
    const customSizeValue = this.customSize();

    if (customSizeValue) {
      return cn('animate-spin', this.class());
    }

    return cn('animate-spin', RING_SIZE_MAP[this.size()], this.class());
  });

  readonly customStyles = computed(() => {
    const customSizeValue = this.customSize();
    if (customSizeValue) {
      return `width: ${customSizeValue}px; height: ${customSizeValue}px;`;
    }
    return '';
  });

  readonly dotClass = computed(() => DOT_SIZE_MAP[this.size()]);

  readonly barClass = computed(() => BAR_SIZE_MAP[this.size()]);

  readonly pulseClass = computed(() => PULSE_SIZE_MAP[this.size()]);
}
