import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  ElementRef,
  inject,
  effect,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-resizable-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
    '[style.flexGrow]': '"0"',
    '[style.flexShrink]': '"0"',
    '[attr.data-slot]': '"resizable-panel"',
  },
})
export class ResizablePanelComponent {
  readonly el = inject(ElementRef);
  /** Extra classes merged onto the host. The panel is `overflow-hidden min-w-0 min-h-0` so its content can never stop it shrinking; put your own scroll container inside. */
  class = input('');
  /** Starting size as a percentage of the group. Applied in a `setTimeout` after construction, so the panel renders at 50% for one frame first. Read once — changing it later does not resize the panel. */
  defaultSize = input(50);
  /**
   * Intended lower bound, in percent.
   * **Currently not enforced:** dragging is clamped by the handle to a hardcoded
   * 10–90% range and never reads this input.
   */
  minSize = input(10);
  /**
   * Intended upper bound, in percent.
   * **Currently not enforced** — see {@link minSize}.
   */
  maxSize = input(90);

  /** Current size in percent, mirrored into `flex-basis`. Only tracks sizes set through {@link updateSize}; a handle drag writes `flex-basis` straight to the DOM, leaving this signal stale. */
  size = signal(50);
  /** Emitted by {@link updateSize} only. A user dragging a handle does **not** emit here — listen to the handle's `resized` output for that. */
  sizeChange = output<number>();

  constructor() {
    effect(() => {
      this.el.nativeElement.style.flexBasis = `${this.size()}%`;
    });

    setTimeout(() => {
      this.size.set(this.defaultSize());
    }, 0);
  }

  /**
   * Programmatically resizes the panel to `newSize` percent and emits
   * {@link sizeChange}. Not clamped — neither against {@link minSize}/{@link maxSize}
   * nor against the siblings — and the neighbouring panel is not adjusted, so
   * the panels can end up summing to more or less than 100%.
   */
  updateSize(newSize: number): void {
    this.size.set(newSize);
    this.sizeChange.emit(newSize);
  }

  classes = computed(() => cn('overflow-hidden min-h-0 min-w-0', this.class()));
}
