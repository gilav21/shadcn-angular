import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ScrollAreaComponent } from './scroll-area.component';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Orientation = 'vertical' | 'horizontal' | 'both';

interface Metrics {
  readonly scrollTop?: number;
  readonly scrollLeft?: number;
  readonly scrollHeight?: number;
  readonly scrollWidth?: number;
  readonly clientHeight?: number;
  readonly clientWidth?: number;
}

@Component({
  template: `
    <ui-scroll-area class="h-[200px] w-[200px]" [orientation]="orientation()">
      <div class="content">Content</div>
    </ui-scroll-area>
  `,
  imports: [ScrollAreaComponent],
})
class TestHostComponent {
  readonly orientation = signal<Orientation>('vertical');
}

const injectMetrics = (el: HTMLElement, m: Metrics): void => {
  const store = { top: m.scrollTop ?? 0, left: m.scrollLeft ?? 0 };
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => store.top,
    set: (v: number) => {
      store.top = v;
    },
  });
  Object.defineProperty(el, 'scrollLeft', {
    configurable: true,
    get: () => store.left,
    set: (v: number) => {
      store.left = v;
    },
  });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => m.scrollHeight ?? 0 });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => m.scrollWidth ?? 0 });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => m.clientHeight ?? 0 });
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => m.clientWidth ?? 0 });
};

describe('ScrollAreaComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let originalResizeObserver: typeof ResizeObserver;
  let originalGetRect: typeof Element.prototype.getBoundingClientRect;
  let resizeCallbacks: ResizeObserverCallback[];

  const getScrollArea = (): ScrollAreaComponent =>
    fixture.debugElement.query(By.directive(ScrollAreaComponent)).componentInstance as ScrollAreaComponent;

  const getViewport = (): HTMLElement =>
    fixture.debugElement.query(By.css('[data-slot="scroll-area-viewport"]')).nativeElement as HTMLElement;

  const applyMetrics = (m: Metrics): void => {
    injectMetrics(getViewport(), m);
    getViewport().dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    originalResizeObserver = globalThis.ResizeObserver;
    originalGetRect = Element.prototype.getBoundingClientRect;
    resizeCallbacks = [];

    class ResizeObserverStub {
      constructor(cb: ResizeObserverCallback) {
        resizeCallbacks.push(cb);
      }
      observe(): void {
        /* no-op */
      }
      unobserve(): void {
        /* no-op */
      }
      disconnect(): void {
        /* no-op */
      }
    }
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    Element.prototype.getBoundingClientRect = () =>
      ({ x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}) }) as DOMRect;

    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    try {
      fixture.destroy();
    } catch {
      /* fixture may already be destroyed by a test */
    }
    vi.restoreAllMocks();
    globalThis.ResizeObserver = originalResizeObserver;
    Element.prototype.getBoundingClientRect = originalGetRect;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('applies the custom class to the root element', () => {
    const root = fixture.debugElement.query(By.css('[data-slot="scroll-area"]')).nativeElement as HTMLElement;
    expect(root.getAttribute('class') ?? '').toContain('h-[200px]');
  });

  it('has scrollbar-none on the viewport to hide native scrollbars', () => {
    expect(getViewport().classList.contains('scrollbar-none')).toBe(true);
  });

  it('reports default thumb percentages when no metrics are available', () => {
    const scrollArea = getScrollArea();
    expect(scrollArea.thumbHeightPercent()).toBe(100);
    expect(scrollArea.thumbWidthPercent()).toBe(100);
    expect(scrollArea.scrollTopPercent()).toBe(0);
    expect(scrollArea.scrollLeftPercent()).toBe(0);
    expect(scrollArea.showVertical()).toBe(false);
  });

  it('shows the vertical scrollbar and computes thumb metrics when content overflows vertically', () => {
    applyMetrics({ scrollHeight: 1000, clientHeight: 100, scrollTop: 200, scrollWidth: 100, clientWidth: 100 });
    const scrollArea = getScrollArea();

    expect(scrollArea.showVertical()).toBe(true);
    expect(scrollArea.thumbHeightPercent()).toBe(10);
    expect(scrollArea.scrollTopPercent()).toBeGreaterThan(0);
    expect(fixture.debugElement.query(By.css('[data-orientation="vertical"]'))).toBeTruthy();
  });

  it('hides scrollbars when content fits', () => {
    applyMetrics({ scrollHeight: 100, clientHeight: 100, scrollWidth: 100, clientWidth: 100 });
    const scrollArea = getScrollArea();

    expect(scrollArea.showVertical()).toBe(false);
    expect(scrollArea.scrollTopPercent()).toBe(0);
    expect(fixture.debugElement.query(By.css('[data-orientation="vertical"]'))).toBeFalsy();
  });

  it('shows the horizontal scrollbar for horizontal orientation', () => {
    component.orientation.set('horizontal');
    fixture.detectChanges();
    applyMetrics({ scrollWidth: 1000, clientWidth: 100, scrollLeft: 200, scrollHeight: 100, clientHeight: 100 });
    const scrollArea = getScrollArea();

    expect(scrollArea.showHorizontal()).toBe(true);
    expect(scrollArea.showVertical()).toBe(false);
    expect(scrollArea.thumbWidthPercent()).toBe(10);
    expect(scrollArea.scrollLeftPercent()).toBeGreaterThan(0);
    expect(fixture.debugElement.query(By.css('[data-orientation="horizontal"]'))).toBeTruthy();
  });

  it('renders both scrollbars and the corner for orientation "both"', () => {
    component.orientation.set('both');
    fixture.detectChanges();
    applyMetrics({ scrollHeight: 1000, clientHeight: 100, scrollWidth: 1000, clientWidth: 100 });
    const scrollArea = getScrollArea();

    expect(scrollArea.showVertical()).toBe(true);
    expect(scrollArea.showHorizontal()).toBe(true);
    expect(fixture.debugElement.queryAll(By.css('[data-slot="scroll-area-scrollbar"]'))).toHaveLength(2);
  });

  it('recomputes metrics when the ResizeObserver fires', () => {
    injectMetrics(getViewport(), { scrollHeight: 1000, clientHeight: 100 });
    expect(getScrollArea().showVertical()).toBe(false);

    resizeCallbacks[0]([], {} as ResizeObserver);
    fixture.detectChanges();

    expect(getScrollArea().showVertical()).toBe(true);
  });

  it('scrolls the viewport vertically when dragging the vertical thumb with a mouse', () => {
    applyMetrics({ scrollHeight: 1000, clientHeight: 100, scrollWidth: 100, clientWidth: 100 });
    const viewport = getViewport();
    const thumb = fixture.debugElement.query(
      By.css('[data-orientation="vertical"] [data-slot="scroll-area-thumb"]'),
    ).nativeElement as HTMLElement;

    thumb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 100 }));
    globalThis.window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 0, clientY: 150 }));

    expect(viewport.scrollTop).toBe(500);

    globalThis.window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    globalThis.window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 0, clientY: 300 }));
    expect(viewport.scrollTop).toBe(500);
  });

  it('scrolls the viewport horizontally when dragging the horizontal thumb with a mouse', () => {
    component.orientation.set('horizontal');
    fixture.detectChanges();
    applyMetrics({ scrollWidth: 1000, clientWidth: 100, scrollHeight: 100, clientHeight: 100 });
    const viewport = getViewport();
    const thumb = fixture.debugElement.query(
      By.css('[data-orientation="horizontal"] [data-slot="scroll-area-thumb"]'),
    ).nativeElement as HTMLElement;

    thumb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 20, clientY: 0 }));
    globalThis.window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 70, clientY: 0 }));

    expect(viewport.scrollLeft).toBe(500);
    globalThis.window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  it('scrolls the viewport when dragging the thumb with touch input', () => {
    applyMetrics({ scrollHeight: 1000, clientHeight: 100, scrollWidth: 100, clientWidth: 100 });
    const viewport = getViewport();
    const scrollArea = getScrollArea();

    const touchStart = {
      preventDefault: () => {
        /* no-op */
      },
      touches: [{ clientX: 5, clientY: 5 }],
    } as unknown as TouchEvent;
    scrollArea.onThumbDragStart(touchStart, 'vertical');

    const move = new Event('touchmove');
    Object.defineProperty(move, 'touches', { value: [{ clientX: 5, clientY: 30 }] });
    globalThis.window.dispatchEvent(move);

    expect(viewport.scrollTop).toBe(250);
    globalThis.window.dispatchEvent(new Event('touchend'));
  });

  it('ignores thumb drag and scroll when the viewport is unavailable', () => {
    const scrollArea = getScrollArea();
    scrollArea.viewportRef = undefined;

    const event = new MouseEvent('mousedown', { clientX: 0, clientY: 0 });
    expect(() => scrollArea.onThumbDragStart(event, 'vertical')).not.toThrow();
    expect(() => scrollArea.onScroll()).not.toThrow();
    expect(scrollArea.scrollTopPercent()).toBe(0);
  });

  it('scrolls to the bottom via requestAnimationFrame', () => {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const scrollArea = getScrollArea();
    const viewport = getViewport();
    injectMetrics(viewport, { scrollHeight: 800, clientHeight: 100 });

    scrollArea.scrollToBottom();

    expect(viewport.scrollTop).toBe(800);
  });

  it('cleans up an active drag when the component is destroyed', () => {
    applyMetrics({ scrollHeight: 1000, clientHeight: 100, scrollWidth: 100, clientWidth: 100 });
    const thumb = fixture.debugElement.query(
      By.css('[data-orientation="vertical"] [data-slot="scroll-area-thumb"]'),
    ).nativeElement as HTMLElement;

    thumb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 100 }));

    expect(() => fixture.destroy()).not.toThrow();
  });
});
