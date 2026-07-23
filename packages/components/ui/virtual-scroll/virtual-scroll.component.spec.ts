import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { VirtualScrollComponent, VirtualItemDirective, VirtualItem } from './virtual-scroll.component';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

interface TestItem extends VirtualItem {
    id: number;
    name: string;
}

function createItems(count: number): TestItem[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
    }));
}

/**
 * Private surface of the component exercised directly by these specs. jsdom has
 * no layout, so the runway math (offsets, resize handling, scroll progress) is
 * driven through these members rather than real DOM measurement.
 */
type VsPrivate = {
    getOffsetForIndex(index: number): number;
    getIndexForOffset(scrollY: number): number;
    handleResizes(entries: ResizeObserverEntry[]): void;
    calculateScrollProgress(): number;
};

type VsComponent = VirtualScrollComponent<TestItem>;

// jsdom reports 0 for every layout metric and no-ops scrollTop assignment, so
// the component can never observe a scroll. This injects a settable scrollTop
// backing store plus fixed height metrics and returns a restore fn.
function installViewportMetrics(
    el: HTMLElement,
    clientHeight: number,
    scrollHeight: number,
): () => void {
    const saved = new Map<string, PropertyDescriptor | undefined>();
    let backingScrollTop = 0;
    const define = (prop: string, get: () => number, set?: (v: number) => void): void => {
        saved.set(prop, Object.getOwnPropertyDescriptor(el, prop));
        Object.defineProperty(el, prop, { configurable: true, get, set });
    };
    define('scrollTop', () => backingScrollTop, (v: number) => { backingScrollTop = v; });
    define('clientHeight', () => clientHeight);
    define('scrollHeight', () => scrollHeight);
    define('offsetHeight', () => clientHeight);
    // jsdom does not implement Element.scrollTo; scrollToIndex calls it.
    saved.set('scrollTo', Object.getOwnPropertyDescriptor(el, 'scrollTo'));
    Object.defineProperty(el, 'scrollTo', {
        configurable: true,
        value: (opts: ScrollToOptions) => { backingScrollTop = opts.top ?? backingScrollTop; },
    });
    return () => {
        for (const [prop, desc] of saved) {
            if (desc) {
                Object.defineProperty(el, prop, desc);
            } else {
                delete (el as unknown as Record<string, unknown>)[prop];
            }
        }
    };
}

// A single ResizeObserverEntry shaped exactly as handleResizes reads it.
function resizeEntry(index: string | undefined, blockSize: number): ResizeObserverEntry {
    return {
        target: { dataset: index === undefined ? {} : { index } },
        borderBoxSize: [{ blockSize, inlineSize: 0 }],
    } as unknown as ResizeObserverEntry;
}

// jsdom lacks ResizeObserver; the component constructs two. Capture every
// callback so specs can invoke the item-resize and container-resize paths.
let savedResizeObserver: typeof ResizeObserver | undefined;
let roCallbacks: ResizeObserverCallback[] = [];

beforeEach(() => {
    savedResizeObserver = globalThis.ResizeObserver;
    roCallbacks = [];
    class StubResizeObserver {
        constructor(cb: ResizeObserverCallback) {
            roCallbacks.push(cb);
        }
        observe(): void { /* no layout in jsdom */ }
        unobserve(): void { /* no layout in jsdom */ }
        disconnect(): void { /* no layout in jsdom */ }
    }
    globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
    globalThis.ResizeObserver = savedResizeObserver as typeof ResizeObserver;
});

@Component({
    template: `
        <div style="height: 300px; width: 400px;">
            <ui-virtual-scroll
                [items]="items()"
                [minItemHeight]="50"
                [buffer]="5"
                [loading]="loading()"
                [hasMore]="hasMore()"
                (windowChange)="onWindowChange($event)"
                (scrollEnd)="onScrollEnd()"
                (scrollState)="onScrollState($event)"
            >
                <ng-template uiVirtualItem let-item let-index="index">
                    <div class="test-item" style="height: 50px;" [attr.data-test-index]="index">{{ $any(item).name }}</div>
                </ng-template>
            </ui-virtual-scroll>
        </div>
    `,
    imports: [VirtualScrollComponent, VirtualItemDirective]
})
class TestHostComponent {
    items = signal<TestItem[]>(createItems(100));
    loading = signal(false);
    hasMore = signal(true);
    windowChangeEvents: { start: number; end: number }[] = [];
    scrollEndCount = 0;
    scrollStateEvents: unknown[] = [];

    onWindowChange(event: { start: number; end: number }) {
        this.windowChangeEvents.push(event);
    }
    onScrollEnd() {
        this.scrollEndCount++;
    }
    onScrollState(event: unknown) {
        this.scrollStateEvents.push(event);
    }
}

describe('VirtualScrollComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let container: HTMLElement;
    let restoreMetrics: () => void;

    const getVs = (): VsComponent =>
        fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance;
    const asPrivate = (vs: VsComponent): VsPrivate => vs as unknown as VsPrivate;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();

        container = fixture.nativeElement.querySelector('[data-slot="virtual-scroll"]');
        restoreMetrics = installViewportMetrics(container, 300, 5000);
    });

    afterEach(() => {
        restoreMetrics();
        fixture.destroy();
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should accept items input', () => {
        expect(host.items()).toHaveLength(100);
    });

    it('should render the virtual scroll container', () => {
        expect(container).toBeTruthy();
    });

    it('should render only a subset of items (not all 100)', () => {
        const renderedItems = fixture.nativeElement.querySelectorAll('.test-item');
        expect(renderedItems.length).toBeLessThan(100);
        expect(renderedItems.length).toBeGreaterThan(0);
    });

    it('should update when items change', async () => {
        host.items.set(createItems(50));
        fixture.detectChanges();
        await fixture.whenStable();

        const renderedItems = fixture.nativeElement.querySelectorAll('.test-item');
        expect(renderedItems.length).toBeGreaterThan(0);
        expect(renderedItems.length).toBeLessThanOrEqual(50);
    });

    it('should show loading indicator when loading is true', async () => {
        host.loading.set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const loadingEl = fixture.nativeElement.querySelector('.animate-spin');
        expect(loadingEl).toBeTruthy();
    });

    it('should not show loading indicator when loading is false', () => {
        host.loading.set(false);
        fixture.detectChanges();

        const loadingEl = fixture.nativeElement.querySelector('.animate-spin');
        expect(loadingEl).toBeFalsy();
    });

    it('should virtualize and limit rendered items to roughly viewport + buffer count', () => {
        const renderedItems = fixture.nativeElement.querySelectorAll('.test-item');
        expect(renderedItems.length).toBeLessThanOrEqual(20);
        expect(renderedItems.length).toBeGreaterThan(0);
    });

    it('should assign correct _virtualIndex via data-index attribute on rendered items', () => {
        const virtualItems = fixture.nativeElement.querySelectorAll('.virtual-item');
        expect(virtualItems.length).toBeGreaterThan(0);

        const firstIndex = Number.parseInt(virtualItems[0].dataset.index, 10);
        expect(firstIndex).toBe(0);

        for (let i = 1; i < virtualItems.length; i++) {
            const idx = Number.parseInt(virtualItems[i].dataset.index, 10);
            expect(idx).toBe(firstIndex + i);
        }
    });

    it('should update scrollTop signal when scroll event is dispatched', () => {
        const vsComponent = getVs();

        expect(vsComponent.scrollTop()).toBe(0);

        container.scrollTop = 500;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        expect(vsComponent.scrollTop()).toBe(500);
    });

    it('should render different items after scrolling down', () => {
        const itemsBefore = fixture.nativeElement.querySelectorAll('.virtual-item');
        const firstIndexBefore = Number.parseInt(itemsBefore[0].dataset.index, 10);
        expect(firstIndexBefore).toBe(0);

        container.scrollTop = 2000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        const itemsAfter = fixture.nativeElement.querySelectorAll('.virtual-item');
        const firstIndexAfter = Number.parseInt(itemsAfter[0].dataset.index, 10);
        expect(firstIndexAfter).toBeGreaterThan(0);
    });

    it('should render no items when items array is empty', () => {
        host.items.set([]);
        fixture.detectChanges();

        const renderedItems = fixture.nativeElement.querySelectorAll('.test-item');
        expect(renderedItems).toHaveLength(0);
    });

    it('should emit windowChange output when render range changes', () => {
        host.windowChangeEvents = [];

        container.scrollTop = 1000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        expect(host.windowChangeEvents.length).toBeGreaterThan(0);
        const lastEvent = host.windowChangeEvents.at(-1)!;
        expect(lastEvent).toHaveProperty('start');
        expect(lastEvent).toHaveProperty('end');
        expect(lastEvent.start).toBeGreaterThan(0);
    });

    it('should emit scrollEnd when near the bottom of the list', async () => {
        const vsComponent = getVs();

        host.scrollEndCount = 0;
        host.hasMore.set(true);
        host.loading.set(false);
        host.items.set(createItems(5));
        fixture.detectChanges();

        vsComponent.containerHeight.set(300);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(host.scrollEndCount).toBeGreaterThan(0);
    });

    it('should scroll to a specific index via scrollToIndex', () => {
        const vsComponent = getVs();

        vsComponent.scrollToIndex(50);
        fixture.detectChanges();

        expect(vsComponent.scrollTop()).toBe(50 * 50);
    });

    it('should be a no-op when scrollToIndex runs without a container', () => {
        const vsComponent = getVs();
        vsComponent.containerRef = signal(undefined).asReadonly();

        expect(() => vsComponent.scrollToIndex(10)).not.toThrow();
        expect(vsComponent.scrollTop()).toBe(0);
    });

    it('should scroll to the bottom via scrollToBottom', () => {
        const vsComponent = getVs();

        vsComponent.scrollToBottom();

        expect(container.scrollTop).toBe(5000);
    });

    it('should be a no-op when scrollToBottom runs without a container', () => {
        const vsComponent = getVs();
        vsComponent.containerRef = signal(undefined).asReadonly();

        expect(() => vsComponent.scrollToBottom()).not.toThrow();
    });

    it('should apply padding-top on the content wrapper after scrolling', () => {
        const vsComponent = getVs();

        container.scrollTop = 2000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        const paddingTopValue = vsComponent.paddingTop();
        expect(paddingTopValue).toBeGreaterThan(0);

        const contentWrapper = container.querySelector('.flex.flex-col') as HTMLElement | null;
        if (contentWrapper) {
            expect(Number.parseInt(contentWrapper.style.paddingTop, 10)).toBeGreaterThan(0);
        }
    });

    it('should emit scrollState output with correct shape', () => {
        host.scrollStateEvents = [];

        container.scrollTop = 500;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        expect(host.scrollStateEvents.length).toBeGreaterThan(0);
        const lastState = host.scrollStateEvents.at(-1) as Record<string, unknown>;
        expect(lastState).toHaveProperty('windowStart');
        expect(lastState).toHaveProperty('windowEnd');
        expect(lastState).toHaveProperty('windowSize');
        expect(lastState).toHaveProperty('totalItems');
        expect(lastState).toHaveProperty('scrollProgress');
        expect(lastState['totalItems']).toBe(100);
    });

    it('should compute viewportRange as {start: 0, end: 0} when items is empty', () => {
        host.items.set([]);
        fixture.detectChanges();

        const vsComponent = getVs();
        expect(vsComponent.viewportRange()).toEqual({ start: 0, end: 0 });
    });

    it('should compute renderRange that adds buffer to viewportRange', () => {
        const vsComponent = getVs();
        const viewport = vsComponent.viewportRange();
        const render = vsComponent.renderRange();

        expect(render.start).toBeLessThanOrEqual(viewport.start);
        expect(render.end).toBeGreaterThanOrEqual(viewport.end);
        expect(viewport.start - render.start).toBeLessThanOrEqual(5);
        expect(render.end - viewport.end).toBeLessThanOrEqual(5);
    });

    it('should include _virtualIndex property on visibleItems', () => {
        const vsComponent = getVs();
        const visible = vsComponent.visibleItems();

        expect(visible.length).toBeGreaterThan(0);
        for (const item of visible) {
            expect(item).toHaveProperty('_virtualIndex');
            expect(typeof item._virtualIndex).toBe('number');
        }
    });

    it('should compute paddingBottom greater than zero when not scrolled to end', () => {
        const vsComponent = getVs();
        expect(vsComponent.paddingBottom()).toBeGreaterThan(0);
    });

    it('should scroll to top via scrollToTop', () => {
        const vsComponent = getVs();

        vsComponent.scrollToIndex(50);
        fixture.detectChanges();
        expect(vsComponent.scrollTop()).toBeGreaterThan(0);

        vsComponent.scrollToTop();
        fixture.detectChanges();
        expect(vsComponent.scrollTop()).toBe(0);
    });

    it('should compute offsets across chunk boundaries for far indices', () => {
        const priv = asPrivate(getVs());
        // Chunk size is 500 items * 50px = 25000px per full chunk.
        expect(priv.getOffsetForIndex(600)).toBe(25000 + 100 * 50);
        expect(priv.getOffsetForIndex(0)).toBe(0);
    });

    it('should clamp the index when scrolling past the end of the content', () => {
        const priv = asPrivate(getVs());
        // Total content is 100 * 50 = 5000px; scrolling far beyond clamps to last.
        expect(priv.getIndexForOffset(999999)).toBe(99);
    });

    it('should recompute container height when the container ResizeObserver fires', () => {
        const vsComponent = getVs();
        vsComponent.containerHeight.set(0);

        // roCallbacks[1] is the container observer created in ngAfterViewInit.
        roCallbacks[1]([], {} as ResizeObserver);

        expect(vsComponent.containerHeight()).toBe(300);
    });

    it('should apply measured item heights via the item ResizeObserver callback', () => {
        const vsComponent = getVs();
        const priv = asPrivate(vsComponent);
        const before = vsComponent.measurementVersion();

        // roCallbacks[0] is the item observer wired to handleResizes.
        roCallbacks[0]([resizeEntry('0', 120)], {} as ResizeObserver);

        expect(vsComponent.measurementVersion()).toBe(before + 1);
        expect(priv.getOffsetForIndex(1)).toBe(120);
    });

    it('should ignore resize entries without an index or with a negligible delta', () => {
        const vsComponent = getVs();
        const priv = asPrivate(vsComponent);

        priv.handleResizes([
            resizeEntry(undefined, 200),
            resizeEntry('-1', 200),
            resizeEntry('0', 50),
        ]);

        // No real change applied: index 1 still sits at one min-height.
        expect(priv.getOffsetForIndex(1)).toBe(50);
    });

    it('should grow paddingBottom offsets after items are measured taller', () => {
        const vsComponent = getVs();
        const priv = asPrivate(vsComponent);

        // Index 50 sits well past the rendered/viewport window (~0-11 with the
        // 300px viewport + buffer used by this fixture), in both jsdom and a
        // real browser. paddingBottom subtracts getOffsetForIndex(renderEnd),
        // which never touches index 50, so growing it can only ever inflate
        // the total-height term — deterministic across environments, unlike
        // an in-window index whose growth is simultaneously added to and
        // subtracted from the padding math and can net out to zero.
        const before = vsComponent.paddingBottom();
        priv.handleResizes([resizeEntry('50', 150)]);
        fixture.detectChanges();

        expect(vsComponent.paddingBottom()).toBeGreaterThan(before);
    });

    it('should report zero scroll progress when there is no container', () => {
        const vsComponent = getVs();
        vsComponent.containerRef = signal(undefined).asReadonly();

        expect(asPrivate(vsComponent).calculateScrollProgress()).toBe(0);
    });

    it('should report zero scroll progress when content fits the viewport', () => {
        const vsComponent = getVs();
        vsComponent.containerRef = signal({
            nativeElement: { scrollTop: 0, scrollHeight: 100, clientHeight: 300 },
        } as unknown as never).asReadonly();

        expect(asPrivate(vsComponent).calculateScrollProgress()).toBe(0);
    });

    it('should report a fractional scroll progress when scrolled within tall content', () => {
        const vsComponent = getVs();
        vsComponent.containerRef = signal({
            nativeElement: { scrollTop: 2000, scrollHeight: 5000, clientHeight: 300 },
        } as unknown as never).asReadonly();

        const progress = asPrivate(vsComponent).calculateScrollProgress();
        expect(progress).toBeCloseTo(2000 / (5000 - 300), 5);
    });

    it('should disconnect observers on destroy', () => {
        expect(() => fixture.destroy()).not.toThrow();
    });
});

describe('VirtualItemDirective', () => {
    it('narrows the template context via its static ngTemplateContextGuard', () => {
        const dir = new VirtualItemDirective();
        expect(
            VirtualItemDirective.ngTemplateContextGuard(dir, { $implicit: { id: 1 }, index: 0 }),
        ).toBe(true);
    });
});

@Component({
    template: `
        <div style="height: 300px; width: 400px;">
            <ui-virtual-scroll [items]="items()" [minItemHeight]="50" [buffer]="5">
                <ng-template virtualItem let-item>
                    <div class="test-item" style="height: 50px;">{{ $any(item).name }}</div>
                </ng-template>
            </ui-virtual-scroll>
        </div>
    `,
    imports: [VirtualScrollComponent, VirtualItemDirective]
})
class DeprecatedSelectorHostComponent {
    readonly items = signal<TestItem[]>(createItems(100));
}

describe('VirtualScrollComponent deprecated [virtualItem] selector alias', () => {
    it('binds VirtualItemDirective via the old [virtualItem] selector and renders rows', async () => {
        await TestBed.configureTestingModule({
            imports: [DeprecatedSelectorHostComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(DeprecatedSelectorHostComponent);
        fixture.detectChanges();

        const rendered = fixture.nativeElement.querySelectorAll('.test-item');
        expect(rendered.length).toBeGreaterThan(0);
    });
});

// A consumer row type with NO `id` field and NO index signature — must satisfy
// the relaxed `T extends VirtualItem` constraint (the cast a stricter VirtualItem
// previously forced is no longer needed).
interface Group {
    name: string;
    count: number;
}

@Component({
    template: `
        <div style="height: 300px; width: 400px;">
            <ui-virtual-scroll [items]="groups()" [minItemHeight]="50">
                <ng-template uiVirtualItem let-g>
                    <div class="group-item" style="height: 50px;">{{ $any(g).name }}</div>
                </ng-template>
            </ui-virtual-scroll>
        </div>
    `,
    imports: [VirtualScrollComponent, VirtualItemDirective],
})
class NoIdHostComponent {
    readonly groups = signal<Group[]>(
        Array.from({ length: 30 }, (_, i) => ({ name: `Group ${i}`, count: i })),
    );
}

describe('VirtualScrollComponent with an id-less row type', () => {
    it('accepts and renders items that have no id (relaxed VirtualItem)', async () => {
        await TestBed.configureTestingModule({ imports: [NoIdHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(NoIdHostComponent);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('.group-item').length).toBeGreaterThan(0);
    });
});
