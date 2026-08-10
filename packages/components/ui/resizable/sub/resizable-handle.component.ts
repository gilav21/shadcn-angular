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
        tabindex="0"
        role="separator"
        aria-valuenow="50"
        aria-valuemin="0"
        aria-valuemax="100"
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
  /** Accessible name for the `separator`. Give each handle a distinct one in a multi-panel group. Note the divider is focusable but has no key handling, so it cannot actually be resized from the keyboard, and its `aria-valuenow` is a fixed 50. */
  ariaLabel = input('Resize Handle');

  /**
   * Fires continuously during a drag with the pixel `delta` and the two adjacent
   * panels' new percentages. The handle has **already** written those sizes to
   * the DOM — this is a notification, not a request, and there is nothing to
   * feed back. Sizes are written as inline `flex-basis`, bypassing the panels'
   * own `size` signals, so they will not survive a re-render that resets style.
   * Nothing is emitted at drag end, and nothing is persisted.
   */
  resized = output<{ delta: number; sizes: number[] }>();


  private readonly isDragging = signal(false);
  private readonly detectedDirection = signal<'horizontal' | 'vertical'>('horizontal');

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
  }

  handleStyles = computed(() => {
    const isHorizontal = this.detectedDirection() === 'horizontal';
    const size = this.handleSize();
    if (isHorizontal) {
      return `width: ${size}px; min-width: ${size}px; touch-action: none;`;
    }
    return `height: ${size}px; min-height: ${size}px; touch-action: none;`;
  });

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
   * immediate siblings. Both panels are clamped to 10–90% of the group — the
   * panels' own `minSize`/`maxSize` are ignored — and the move is dropped
   * outright when either would leave that range, so a fast drag stops dead at
   * the limit. Direction is read from the group's `data-direction`, and the
   * delta is mirrored in RTL. Listeners are on `document`, so the drag survives
   * the pointer leaving the handle and ends on mouseup anywhere.
   */
  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.startDrag(event.clientX, event.clientY, false);
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

  private buildMoveHandler(
    ctx: { isHorizontal: boolean; isRtl: boolean; containerSize: number; startX: number; startY: number },
    beforeEl: HTMLElement, afterEl: HTMLElement,
    startSizeBefore: number, startSizeAfter: number
  ): (clientX: number, clientY: number) => void {
    const { isHorizontal, isRtl, containerSize, startX, startY } = ctx;
    return (clientX: number, clientY: number): void => {
      let delta = isHorizontal ? clientX - startX : clientY - startY;
      if (isHorizontal && isRtl) delta = -delta;
      const newPercentBefore = ((startSizeBefore + delta) / containerSize) * 100;
      const newPercentAfter = ((startSizeAfter - delta) / containerSize) * 100;
      if (newPercentBefore >= 10 && newPercentAfter >= 10 &&
        newPercentBefore <= 90 && newPercentAfter <= 90) {
        beforeEl.style.flexBasis = `${newPercentBefore}%`;
        afterEl.style.flexBasis = `${newPercentAfter}%`;
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
    const isRtl = getComputedStyle(document.documentElement).direction === 'rtl';

    const children = Array.from(groupEl.children);
    const handleIndex = children.findIndex(el =>
      el === handleEl || el.querySelector('[data-slot="resizable-handle"]') !== null || el.contains(handleEl)
    );

    const { before: panelBefore, after: panelAfter } = this.findAdjacentPanels(children, handleIndex);
    if (!panelBefore || !panelAfter) return;

    const startSizeBefore = isHorizontal ? panelBefore.offsetWidth : panelBefore.offsetHeight;
    const startSizeAfter = isHorizontal ? panelAfter.offsetWidth : panelAfter.offsetHeight;
    const onMove = this.buildMoveHandler(
      { isHorizontal, isRtl, containerSize, startX, startY },
      panelBefore, panelAfter, startSizeBefore, startSizeAfter);
    this.attachListeners(isTouch, isHorizontal, onMove);
  }
}
