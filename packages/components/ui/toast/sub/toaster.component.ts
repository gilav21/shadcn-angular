import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  afterRenderEffect,
  DestroyRef,
  ElementRef,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ToastService, ToastComponent } from '../toast.component';

@Component({
  selector: 'ui-toaster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastComponent],
  templateUrl: './toaster.component.html',
  host: { class: 'contents' },
})
export class ToasterComponent {
  readonly toastService = inject(ToastService);
  private readonly region = viewChild<ElementRef<HTMLElement>>('region');

  // Two independent holds: leaving with the pointer must not release a pause the focus still owns.
  private pointerInside = false;
  private focusInside = false;
  /** Whether this toaster currently owns a `pause()` on the service, so it never resumes a pause it did not take. */
  private holding = false;

  constructor() {
    // A removed element fires no focusout/pointerleave. After the DOM settles, drop a focus hold whose
    // element is gone, and every hold once the stack is empty — or the next toast would be raised frozen.
    afterRenderEffect(() => {
      const count = this.toastService.toasts().length;
      untracked(() => this.releaseStaleHolds(count));
    });

    inject(DestroyRef).onDestroy(() => {
      this.pointerInside = false;
      this.focusInside = false;
      this.syncPause();
    });
  }

  /** The pointer entered the stack: freeze every auto-dismiss clock until it leaves. */
  onPointerEnter(): void {
    this.pointerInside = true;
    this.syncPause();
  }

  /** The pointer left the stack: resume, unless keyboard focus is still inside it. */
  onPointerLeave(): void {
    this.pointerInside = false;
    this.syncPause();
  }

  /** Focus entered a toast (e.g. tabbing to its action): freeze the clocks so it cannot vanish mid-tab. */
  onFocusIn(): void {
    this.focusInside = true;
    this.syncPause();
  }

  /** Focus left a control; it only counts as leaving the stack when it did not move to another control inside it. */
  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && this.region()?.nativeElement.contains(next)) return;
    this.focusInside = false;
    this.syncPause();
  }

  private releaseStaleHolds(count: number): void {
    const focusGone = this.focusInside && !this.region()?.nativeElement.contains(document.activeElement);
    if (count === 0) this.pointerInside = false;
    if (count === 0 || focusGone) this.focusInside = false;
    this.syncPause();
  }

  private syncPause(): void {
    const wanted = this.pointerInside || this.focusInside;
    if (wanted === this.holding) return;
    this.holding = wanted;
    if (wanted) this.toastService.pause();
    else this.toastService.resume();
  }

  /**
   * Vertical anchor of the fixed stack (default `'bottom'`). Toasts are always appended
   * in arrival order, so `'bottom'` grows downward — newest at the bottom — rather than
   * pushing older ones up.
   */
  vertical = input<'top' | 'center' | 'bottom'>('bottom');
  /**
   * Horizontal anchor of the stack (default `'end'`). `'start'`/`'end'` are
   * direction-aware and flip under RTL. The stack is capped at `420px` wide and shrinks
   * to the viewport on small screens.
   */
  horizontal = input<'start' | 'center' | 'end'>('end');

  /** Extra classes merged onto the fixed stack, after the placement classes — e.g. `bottom-24` to clear a footer bar. */
  readonly class = input('');

  containerClasses = computed(() => {
    const v = this.vertical();
    const h = this.horizontal();

    const verticalClasses: Record<string, string> = {
      'top': 'top-0',
      'center': 'top-1/2 -translate-y-1/2',
      'bottom': 'bottom-0',
    };

    const horizontalClasses: Record<string, string> = {
      'start': 'ltr:left-0 rtl:right-0',
      'center': 'left-1/2 -translate-x-1/2',
      'end': 'ltr:right-0 rtl:left-0',
    };

    return cn(
      'fixed z-[100] flex flex-col gap-2 p-4 w-full max-w-[calc(100vw-2rem)] sm:max-w-[420px]',
      verticalClasses[v],
      horizontalClasses[h],
      this.class(),
    );
  });
}
