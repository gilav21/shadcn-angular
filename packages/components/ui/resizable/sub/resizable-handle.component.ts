import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  ElementRef,
  inject,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ResizablePanelComponent } from './resizable-panel.component';

const DEFAULT_MIN_SIZE = 10;
const DEFAULT_MAX_SIZE = 90;
const KEYBOARD_STEP = 5;

interface PanelLimits {
  min: number;
  max: number;
}

interface AdjacentPanels {
  beforeEl: HTMLElement;
  afterEl: HTMLElement;
  before?: ResizablePanelComponent;
  after?: ResizablePanelComponent;
}

@Component({
  selector: 'ui-resizable-handle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!disabled()) {
      <div
        #handleEl
        [class]="classes()"
        [style]="handleStyles()"
        [attr.data-slot]="'resizable-handle'"
        (mousedown)="onMouseDown($event)"
        (touchstart)="onTouchStart($event)"
        (keydown)="onKeydown($event)"
        tabindex="0"
        role="separator"
        [attr.aria-orientation]="ariaOrientation()"
        [attr.aria-valuenow]="ariaValueNow()"
        [attr.aria-valuemin]="ariaValueMin()"
        [attr.aria-valuemax]="ariaValueMax()"
        [attr.aria-label]="ariaLabel()"
      >
        @if (withHandle()) {
          <div [class]="gripClasses()">
            <svg
              [class]="svgClasses()"
              viewBox="0 0 6 10"
              fill="currentColor"
            >
              <circle cx="1" cy="2" r="0.8"/>
              <circle cx="1" cy="5" r="0.8"/>
              <circle cx="1" cy="8" r="0.8"/>
              <circle cx="5" cy="2" r="0.8"/>
              <circle cx="5" cy="5" r="0.8"/>
              <circle cx="5" cy="8" r="0.8"/>
            </svg>
          </div>
        }
      </div>
    }
  `,
  host: {
    class: 'contents',
  },
})
export class ResizableHandleComponent implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef);

  /** Extra classes merged onto the divider. Its width/height comes from {@link handleSize} as an inline style, so use that rather than a `w-*` utility. */
  class = input('');
  /** Draws the dotted grip pill in the middle of the divider. Off by default: the bare divider is a 4px line, which is easy to miss — turn this on wherever discoverability matters. */
  withHandle = input(false);
  /** Thickness of the divider in px, along the group's axis. Doubles as the hit area, so anything under ~24 is hard to grab on touch; the grip pill does not enlarge it. */
  handleSize = input(4);
  /** Removes the divider entirely (it is `@if`-ed out, not just inert), freezing the panels at their current sizes and collapsing the gap between them. */
  disabled = input(false);
  /** Accessible name for the `separator`. Give each handle a distinct one in a multi-panel group — it is what a screen-reader user hears before the arrow keys resize the pair. */
  ariaLabel = input('Resize Handle');

  /**
   * Fires continuously during a drag, and once per arrow-key press, with the two
   * adjacent panels' new percentages. `delta` is the pixel offset from where the
   * drag started, and is `0` for a keyboard resize. The handle has **already**
   * applied those sizes through the panels' own `setSize()`, so this is a
   * notification, not a request — the panels' `size` signals and their
   * `sizeChange` outputs are equally up to date. Nothing is persisted.
   */
  resized = output<{ delta: number; sizes: number[] }>();


  private readonly isDragging = signal(false);
  private readonly detectedDirection = signal<'horizontal' | 'vertical'>('horizontal');
  private readonly adjacent = signal<AdjacentPanels | null>(null);

  // Store cleanup functions
  private listeners: (() => void)[] = [];

  ngOnDestroy(): void {
    this.cleanupListeners();
  }

  private cleanupListeners(): void {
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    this.isDragging.set(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  ngAfterViewInit(): void {
    const handleEl = this.el.nativeElement as HTMLElement;
    const groupEl = handleEl.closest('[data-slot="resizable-panel-group"]');
    const dir = ((groupEl as HTMLElement | null)?.dataset['direction'] as 'horizontal' | 'vertical') ?? 'horizontal';
    this.detectedDirection.set(dir);
    this.adjacent.set(this.resolveAdjacentPanels());
  }

  handleStyles = computed(() => {
    const isHorizontal = this.detectedDirection() === 'horizontal';
    const size = this.handleSize();
    if (isHorizontal) {
      return `width: ${size}px; min-width: ${size}px; touch-action: none;`;
    }
    return `height: ${size}px; min-height: ${size}px; touch-action: none;`;
  });

  /** `'vertical'` for a divider in a horizontal group and vice versa — the separator's own orientation, which is the axis it moves along inverted. */
  readonly ariaOrientation = computed(() =>
    this.detectedDirection() === 'horizontal' ? 'vertical' : 'horizontal');

  /** The panel-before-the-handle's current size in percent, rounded — kept in step with drags and arrow keys because it reads the panel's `size` signal. */
  readonly ariaValueNow = computed(() =>
    Math.round(this.adjacent()?.before?.size() ?? 50));

  /** The panel-before-the-handle's `minSize`, or 10 when that panel cannot be resolved. */
  readonly ariaValueMin = computed(() =>
    this.adjacent()?.before?.minSize() ?? DEFAULT_MIN_SIZE);

  /** The panel-before-the-handle's `maxSize`, or 90 when that panel cannot be resolved. */
  readonly ariaValueMax = computed(() =>
    this.adjacent()?.before?.maxSize() ?? DEFAULT_MAX_SIZE);

  classes = computed(() => {
    const isHorizontal = this.detectedDirection() === 'horizontal';
    return cn(
      'relative flex items-center justify-center select-none shrink-0',
      'focus-visible:ring-ring focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-none',
      'bg-border hover:bg-primary/30 active:bg-primary/50',
      isHorizontal ? 'cursor-col-resize' : 'cursor-row-resize',
      this.isDragging() && 'bg-primary/50',
      this.class()
    );
  });

  gripClasses = computed(() => {
    const isHorizontal = this.detectedDirection() === 'horizontal';
    return cn(
      'bg-border z-10 flex items-center justify-center rounded-sm border',
      isHorizontal ? 'h-4 w-3' : 'h-3 w-4'
    );
  });

  svgClasses = computed(() => {
    const isHorizontal = this.detectedDirection() === 'horizontal';
    return cn(
      'h-2.5 w-2.5 text-muted-foreground',
      !isHorizontal && 'rotate-90'
    );
  });

  /** Begins a resize from a single-finger touch, cancelling the default so the page does not scroll under the drag. Multi-touch is ignored, so a pinch never starts a resize. */
  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      event.preventDefault();
      this.startDrag(event.touches[0].clientX, event.touches[0].clientY, true);
    }
  }

  /**
   * Begins a mouse resize of the nearest panel on each side, which need not be
   * immediate siblings. Each panel is clamped to its own `minSize`/`maxSize`
   * (10–90% by default) and the move is dropped outright when either would leave
   * its range, so a fast drag stops dead at the limit. Direction is read from the
   * group's `data-direction`, and the delta is mirrored in RTL. Listeners are on
   * `document`, so the drag survives the pointer leaving the handle and ends on
   * mouseup anywhere.
   */
  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.startDrag(event.clientX, event.clientY, false);
  }

  /**
   * Resizes the pair from the keyboard: the arrow keys along the group's axis
   * move the divider 5% per press, mirrored in RTL exactly as the drag is. Both
   * panels are clamped to their own `minSize`/`maxSize`, so a press at the limit
   * settles on the limit rather than being ignored. Every other key is left alone
   * so the divider stays a normal tab stop.
   */
  onKeydown(event: KeyboardEvent): void {
    const step = this.keyboardStepFor(event.key);
    if (step === 0) return;
    event.preventDefault();
    this.nudge(step);
  }

  private keyboardStepFor(key: string): number {
    if (this.detectedDirection() === 'vertical') {
      if (key === 'ArrowUp') return -KEYBOARD_STEP;
      if (key === 'ArrowDown') return KEYBOARD_STEP;
      return 0;
    }
    const sign = this.isRtl() ? -1 : 1;
    if (key === 'ArrowLeft') return -KEYBOARD_STEP * sign;
    if (key === 'ArrowRight') return KEYBOARD_STEP * sign;
    return 0;
  }

  private nudge(step: number): void {
    const panels = this.adjacent() ?? this.resolveAdjacentPanels();
    this.adjacent.set(panels);
    const before = panels?.before;
    const after = panels?.after;
    if (!before || !after) return;

    const total = before.size() + after.size();
    const afterSize = after.clampSize(total - before.clampSize(before.size() + step));
    const beforeSize = total - afterSize;

    before.setSize(beforeSize);
    after.setSize(afterSize);
    this.resized.emit({ delta: 0, sizes: [Math.round(beforeSize), Math.round(afterSize)] });
  }

  private isRtl(): boolean {
    return getComputedStyle(document.documentElement).direction === 'rtl';
  }

  private findAdjacentPanels(
    children: Element[],
    handleIndex: number
  ): { before: HTMLElement | null; after: HTMLElement | null } {
    let before: HTMLElement | null = null;
    let after: HTMLElement | null = null;
    for (let i = handleIndex - 1; i >= 0; i--) {
      if ((children[i] as HTMLElement).dataset['slot'] === 'resizable-panel') {
        before = children[i] as HTMLElement;
        break;
      }
    }
    for (let i = handleIndex + 1; i < children.length; i++) {
      if ((children[i] as HTMLElement).dataset['slot'] === 'resizable-panel') {
        after = children[i] as HTMLElement;
        break;
      }
    }
    return { before, after };
  }

  private resolveAdjacentPanels(): AdjacentPanels | null {
    const handleEl = this.el.nativeElement as HTMLElement;
    const groupEl = handleEl.closest<HTMLElement>('[data-slot="resizable-panel-group"]');
    if (!groupEl) return null;

    const children = Array.from(groupEl.children);
    const handleIndex = children.findIndex(el =>
      el === handleEl || el.querySelector('[data-slot="resizable-handle"]') !== null || el.contains(handleEl)
    );

    const { before, after } = this.findAdjacentPanels(children, handleIndex);
    if (!before || !after) return null;

    return {
      beforeEl: before,
      afterEl: after,
      before: ResizablePanelComponent.forElement(before),
      after: ResizablePanelComponent.forElement(after),
    };
  }

  private limitsOf(el: HTMLElement): PanelLimits {
    const panel = ResizablePanelComponent.forElement(el);
    return {
      min: panel?.minSize() ?? DEFAULT_MIN_SIZE,
      max: panel?.maxSize() ?? DEFAULT_MAX_SIZE,
    };
  }

  private writeSize(el: HTMLElement, size: number): void {
    const panel = ResizablePanelComponent.forElement(el);
    if (panel) {
      panel.setSize(size);
      return;
    }
    el.style.flexBasis = `${size}%`;
  }

  private buildMoveHandler(
    ctx: { isHorizontal: boolean; isRtl: boolean; containerSize: number; startX: number; startY: number },
    beforeEl: HTMLElement, afterEl: HTMLElement,
    startSizeBefore: number, startSizeAfter: number
  ): (clientX: number, clientY: number) => void {
    const { isHorizontal, isRtl, containerSize, startX, startY } = ctx;
    const beforeLimits = this.limitsOf(beforeEl);
    const afterLimits = this.limitsOf(afterEl);
    return (clientX: number, clientY: number): void => {
      let delta = isHorizontal ? clientX - startX : clientY - startY;
      if (isHorizontal && isRtl) delta = -delta;
      const newPercentBefore = ((startSizeBefore + delta) / containerSize) * 100;
      const newPercentAfter = ((startSizeAfter - delta) / containerSize) * 100;
      if (newPercentBefore >= beforeLimits.min && newPercentAfter >= afterLimits.min &&
        newPercentBefore <= beforeLimits.max && newPercentAfter <= afterLimits.max) {
        this.writeSize(beforeEl, newPercentBefore);
        this.writeSize(afterEl, newPercentAfter);
        this.resized.emit({ delta, sizes: [Math.round(newPercentBefore), Math.round(newPercentAfter)] });
      }
    };
  }

  private attachListeners(isTouch: boolean, isHorizontal: boolean, onMove: (x: number, y: number) => void): void {
    const onMouseMove = (e: MouseEvent): void => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent): void => {
      if (e.touches.length === 1) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); }
    };
    const onEnd = (): void => { this.cleanupListeners(); };
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    if (isTouch) {
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onEnd);
      this.listeners.push(
        () => document.removeEventListener('touchmove', onTouchMove),
        () => document.removeEventListener('touchend', onEnd)
      );
    } else {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onEnd);
      this.listeners.push(
        () => document.removeEventListener('mousemove', onMouseMove),
        () => document.removeEventListener('mouseup', onEnd)
      );
    }
  }

  private startDrag(startX: number, startY: number, isTouch: boolean): void {
    this.isDragging.set(true);
    const handleEl = this.el.nativeElement as HTMLElement;
    const groupEl = handleEl.closest<HTMLElement>('[data-slot="resizable-panel-group"]');
    if (!groupEl) return;

    const groupDirection = (groupEl.dataset['direction'] as 'horizontal' | 'vertical') ?? 'horizontal';
    const isHorizontal = groupDirection === 'horizontal';
    const containerSize = isHorizontal ? groupEl.offsetWidth : groupEl.offsetHeight;

    const panels = this.resolveAdjacentPanels();
    if (!panels) return;
    this.adjacent.set(panels);

    const { beforeEl, afterEl } = panels;
    const startSizeBefore = isHorizontal ? beforeEl.offsetWidth : beforeEl.offsetHeight;
    const startSizeAfter = isHorizontal ? afterEl.offsetWidth : afterEl.offsetHeight;
    const onMove = this.buildMoveHandler(
      { isHorizontal, isRtl: this.isRtl(), containerSize, startX, startY },
      beforeEl, afterEl, startSizeBefore, startSizeAfter);
    this.attachListeners(isTouch, isHorizontal, onMove);
  }
}
