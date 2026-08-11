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
  private static readonly instances = new WeakMap<Element, ResizablePanelComponent>();

  /**
   * The panel rendered by a given host element, or `undefined` when the element
   * is not a panel. This is how `ui-resizable-handle` reaches a
   * panel's {@link minSize}/{@link maxSize} and writes its size through
   * {@link setSize} instead of poking `flex-basis` behind the panel's back.
   */
  static forElement(el: Element | null | undefined): ResizablePanelComponent | undefined {
    return el ? ResizablePanelComponent.instances.get(el) : undefined;
  }

  readonly el = inject(ElementRef);
  /** Extra classes merged onto the host. The panel is `overflow-hidden min-w-0 min-h-0` so its content can never stop it shrinking; put your own scroll container inside. */
  class = input('');
  /** Starting size as a percentage of the group. Applied in a `setTimeout` after construction, so the panel renders at 50% for one frame first. Read once — changing it later does not resize the panel. */
  defaultSize = input(50);
  /**
   * Lower bound in percent. Enforced everywhere a size is written: handle drags,
   * the handle's arrow keys, {@link setSize} and {@link updateSize} all clamp to
   * it. It does **not** clamp {@link defaultSize}.
   */
  minSize = input(10);
  /**
   * Upper bound in percent — see {@link minSize} for where it is enforced.
   */
  maxSize = input(90);

  /** Current size in percent, mirrored into `flex-basis`. Every size change goes through {@link setSize}, so this stays accurate through handle drags and keyboard resizes as well as programmatic ones. */
  size = signal(50);
  /** The panel's new size in percent after any change — a handle drag, an arrow-key resize, {@link setSize} or {@link updateSize}. Not emitted when the size is unchanged. */
  sizeChange = output<number>();

  constructor() {
    ResizablePanelComponent.instances.set(this.el.nativeElement, this);

    effect(() => {
      this.el.nativeElement.style.flexBasis = `${this.size()}%`;
    });

    setTimeout(() => {
      this.size.set(this.defaultSize());
    }, 0);
  }

  /** `size` clamped into the {@link minSize}–{@link maxSize} range. */
  clampSize(size: number): number {
    return Math.min(Math.max(size, this.minSize()), this.maxSize());
  }

  /**
   * Resizes this panel alone, clamped to {@link minSize}/{@link maxSize}, and
   * emits {@link sizeChange} when the value actually moves. The neighbouring
   * panel is left untouched — this is what a handle calls for each of the two
   * panels it sits between, once it has worked out both halves. Use
   * {@link updateSize} when you want the sibling kept in step for you.
   */
  setSize(newSize: number): void {
    const clamped = this.clampSize(newSize);
    if (clamped === this.size()) return;
    this.size.set(clamped);
    this.sizeChange.emit(clamped);
  }

  /**
   * Programmatically resizes the panel to `newSize` percent, clamped to
   * {@link minSize}/{@link maxSize}, and takes the difference out of the
   * neighbouring panel (the next one in the group, or the previous one when this
   * is the last), clamped to *its* limits in turn. The pair therefore keeps the
   * total it had before, so the group still sums to 100%. Both panels emit
   * {@link sizeChange}.
   */
  updateSize(newSize: number): void {
    const sibling = this.siblingPanel();
    if (!sibling) {
      this.setSize(newSize);
      return;
    }
    const total = this.size() + sibling.size();
    const siblingSize = sibling.clampSize(total - this.clampSize(newSize));
    this.setSize(total - siblingSize);
    sibling.setSize(siblingSize);
  }

  private siblingPanel(): ResizablePanelComponent | undefined {
    const host = this.el.nativeElement as HTMLElement;
    return this.scanForPanel(host, 'nextElementSibling')
      ?? this.scanForPanel(host, 'previousElementSibling');
  }

  private scanForPanel(
    host: HTMLElement,
    direction: 'nextElementSibling' | 'previousElementSibling'
  ): ResizablePanelComponent | undefined {
    let node: Element | null = host[direction];
    while (node) {
      const panel = ResizablePanelComponent.forElement(node);
      if (panel) return panel;
      node = node[direction];
    }
    return undefined;
  }

  classes = computed(() => cn('overflow-hidden min-h-0 min-w-0', this.class()));
}
