import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { VirtualScrollComponent, VirtualItemDirective, VirtualItem } from './virtual-scroll.component';
import { describe, it, expect, beforeEach } from 'vitest';

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

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should accept items input', () => {
        expect(host.items().length).toBe(100);
    });

    it('should render the virtual scroll container', () => {
        const container = fixture.nativeElement.querySelector('[data-slot="virtual-scroll"]');
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
        // Container height 300px / minItemHeight 50px = 6 viewport items
        // Plus buffer of 5 on each side = max ~16 items
        // At the top, only bottom buffer applies so max ~11
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
        const vsComponent = fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance as VirtualScrollComponent<TestItem>;
        const container = fixture.nativeElement.querySelector('[data-slot="virtual-scroll"]');

        expect(vsComponent.scrollTop()).toBe(0);

        container.scrollTop = 500;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        expect(vsComponent.scrollTop()).toBe(500);
    });

    it('should render different items after scrolling down', () => {
        const container = fixture.nativeElement.querySelector('[data-slot="virtual-scroll"]');

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
        expect(renderedItems.length).toBe(0);
    });

    it('should emit windowChange output when render range changes', () => {
        host.windowChangeEvents = [];

        const container = fixture.nativeElement.querySelector('[data-slot="virtual-scroll"]');
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
        const vsComponent = fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance as VirtualScrollComponent<TestItem>;

        host.scrollEndCount = 0;
        host.hasMore.set(true);
        host.loading.set(false);
        host.items.set(createItems(5));
        fixture.detectChanges();

        // In jsdom, container has no real layout so containerHeight is 0.
        // Manually set containerHeight to simulate a tall container where all items fit.
        vsComponent.containerHeight.set(300);
        fixture.detectChanges();
        await fixture.whenStable();

        // viewportRange end should now be >= totalItems - 2, triggering scrollEnd
        expect(host.scrollEndCount).toBeGreaterThan(0);
    });

    it('should scroll to a specific index via scrollToIndex', () => {
        const vsComponent = fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance as VirtualScrollComponent<TestItem>;

        vsComponent.scrollToIndex(50);
        fixture.detectChanges();

        // scrollToIndex(50) should set scrollTop to 50 * 50 = 2500 (with default minItemHeight)
        expect(vsComponent.scrollTop()).toBe(50 * 50);
    });

    it('should apply padding-top on the content wrapper after scrolling', () => {
        const vsComponent = fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance as VirtualScrollComponent<TestItem>;
        const container = fixture.nativeElement.querySelector('[data-slot="virtual-scroll"]');

        container.scrollTop = 2000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        const paddingTopValue = vsComponent.paddingTop();
        expect(paddingTopValue).toBeGreaterThan(0);

        const contentWrapper = container.querySelector('.flex.flex-col');
        if (contentWrapper) {
            const style = contentWrapper.style.paddingTop;
            expect(Number.parseInt(style, 10)).toBeGreaterThan(0);
        }
    });

    it('should emit scrollState output with correct shape', () => {
        host.scrollStateEvents = [];

        const container = fixture.nativeElement.querySelector('[data-slot="virtual-scroll"]');
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

        const vsComponent = fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance as VirtualScrollComponent<TestItem>;
        expect(vsComponent.viewportRange()).toEqual({ start: 0, end: 0 });
    });

    it('should compute renderRange that adds buffer to viewportRange', () => {
        const vsComponent = fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance as VirtualScrollComponent<TestItem>;
        const viewport = vsComponent.viewportRange();
        const render = vsComponent.renderRange();

        expect(render.start).toBeLessThanOrEqual(viewport.start);
        expect(render.end).toBeGreaterThanOrEqual(viewport.end);
        // Buffer is 5, so the difference on each side should be at most 5
        expect(viewport.start - render.start).toBeLessThanOrEqual(5);
        expect(render.end - viewport.end).toBeLessThanOrEqual(5);
    });

    it('should include _virtualIndex property on visibleItems', () => {
        const vsComponent = fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance as VirtualScrollComponent<TestItem>;
        const visible = vsComponent.visibleItems();

        expect(visible.length).toBeGreaterThan(0);
        for (const item of visible) {
            expect(item).toHaveProperty('_virtualIndex');
            expect(typeof item._virtualIndex).toBe('number');
        }
    });

    it('should compute paddingBottom greater than zero when not scrolled to end', () => {
        const vsComponent = fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance as VirtualScrollComponent<TestItem>;
        const paddingBottom = vsComponent.paddingBottom();
        expect(paddingBottom).toBeGreaterThan(0);
    });

    it('should scroll to top via scrollToTop', () => {
        const vsComponent = fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance as VirtualScrollComponent<TestItem>;

        vsComponent.scrollToIndex(50);
        fixture.detectChanges();
        expect(vsComponent.scrollTop()).toBeGreaterThan(0);

        vsComponent.scrollToTop();
        fixture.detectChanges();
        expect(vsComponent.scrollTop()).toBe(0);
    });
});
