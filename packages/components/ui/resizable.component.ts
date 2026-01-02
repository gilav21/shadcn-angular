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
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
  selector: 'ui-resizable-panel-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      #container
      [class]="classes()" 
      [attr.data-slot]="'resizable-panel-group'"
      [attr.data-direction]="direction()"
    >
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class ResizablePanelGroupComponent {
  class = input('');
  direction = input<'horizontal' | 'vertical'>('horizontal');

  classes = computed(() => cn(
    'flex',
    this.direction() === 'vertical' ? 'flex-col h-full' : 'flex-row w-full',
    this.class()
  ));
}

@Component({
  selector: 'ui-resizable-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
    '[style.flexBasis]': 'size() + "%"',
    '[style.flexGrow]': '"0"',
    '[style.flexShrink]': '"0"',
    '[attr.data-slot]': '"resizable-panel"',
  },
})
export class ResizablePanelComponent {
  class = input('');
  defaultSize = input(50);
  minSize = input(10);
  maxSize = input(90);

  size = signal(50);

  constructor() {
    setTimeout(() => {
      this.size.set(this.defaultSize());
    }, 0);
  }

  classes = computed(() => cn('overflow-hidden min-h-0 min-w-0', this.class()));
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
        tabindex="0"
        role="separator"
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
export class ResizableHandleComponent implements AfterViewInit {
  private el = inject(ElementRef);

  class = input('');
  withHandle = input(false);
  handleSize = input(4); // Size in pixels, default 4px
  disabled = input(false); // Set to true to hide the handle completely

  resize = output<{ delta: number }>();

  private isDragging = signal(false);
  private detectedDirection = signal<'horizontal' | 'vertical'>('horizontal');

  ngAfterViewInit() {
    // Detect direction from parent after view init
    const handleEl = this.el.nativeElement as HTMLElement;
    const groupEl = handleEl.closest('[data-slot="resizable-panel-group"]');
    const dir = (groupEl?.getAttribute('data-direction') as 'horizontal' | 'vertical') || 'horizontal';
    this.detectedDirection.set(dir);
  }

  // Use inline styles for dynamic sizing since Tailwind JIT doesn't support dynamic values
  handleStyles = computed(() => {
    const isHorizontal = this.detectedDirection() === 'horizontal';
    const size = this.handleSize();
    if (isHorizontal) {
      return `width: ${size}px; min-width: ${size}px;`;
    } else {
      return `height: ${size}px; min-height: ${size}px;`;
    }
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

  onTouchStart(event: TouchEvent) {
    if (event.touches.length === 1) {
      event.preventDefault();
      this.startDrag(event.touches[0].clientX, event.touches[0].clientY, true);
    }
  }

  onMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.startDrag(event.clientX, event.clientY, false);
  }

  private startDrag(startX: number, startY: number, isTouch: boolean) {
    this.isDragging.set(true);

    const handleEl = this.el.nativeElement as HTMLElement;
    const groupEl = handleEl.closest('[data-slot="resizable-panel-group"]') as HTMLElement;

    if (!groupEl) {
      console.warn('Resizable handle not inside a panel group');
      return;
    }

    const groupDirection = groupEl.getAttribute('data-direction') as 'horizontal' | 'vertical' || 'horizontal';
    const isHorizontal = groupDirection === 'horizontal';
    const containerSize = isHorizontal ? groupEl.offsetWidth : groupEl.offsetHeight;

    const children = Array.from(groupEl.children);
    const handleIndex = children.findIndex(el =>
      el === handleEl ||
      el.querySelector('[data-slot="resizable-handle"]') !== null ||
      el.contains(handleEl)
    );

    let panelBefore: HTMLElement | null = null;
    let panelAfter: HTMLElement | null = null;

    for (let i = handleIndex - 1; i >= 0; i--) {
      if (children[i].getAttribute('data-slot') === 'resizable-panel') {
        panelBefore = children[i] as HTMLElement;
        break;
      }
    }

    for (let i = handleIndex + 1; i < children.length; i++) {
      if (children[i].getAttribute('data-slot') === 'resizable-panel') {
        panelAfter = children[i] as HTMLElement;
        break;
      }
    }

    if (!panelBefore || !panelAfter) {
      console.warn('Could not find adjacent panels');
      return;
    }

    const startSizeBefore = isHorizontal ? panelBefore.offsetWidth : panelBefore.offsetHeight;
    const startSizeAfter = isHorizontal ? panelAfter.offsetWidth : panelAfter.offsetHeight;

    const onMove = (clientX: number, clientY: number) => {
      const delta = isHorizontal ? clientX - startX : clientY - startY;

      const newSizeBefore = startSizeBefore + delta;
      const newSizeAfter = startSizeAfter - delta;

      const newPercentBefore = (newSizeBefore / containerSize) * 100;
      const newPercentAfter = (newSizeAfter / containerSize) * 100;

      if (newPercentBefore >= 10 && newPercentAfter >= 10 &&
        newPercentBefore <= 90 && newPercentAfter <= 90) {
        panelBefore!.style.flexBasis = `${newPercentBefore}%`;
        panelAfter!.style.flexBasis = `${newPercentAfter}%`;
      }

      this.resize.emit({ delta });
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onEnd = () => {
      this.isDragging.set(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    if (isTouch) {
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    } else {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onEnd);
    }
  }
}
