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

  class = input('');
  withHandle = input(false);
  handleSize = input(4);
  disabled = input(false);
  ariaLabel = input('Resize Handle');

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

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      event.preventDefault();
      this.startDrag(event.touches[0].clientX, event.touches[0].clientY, true);
    }
  }

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
