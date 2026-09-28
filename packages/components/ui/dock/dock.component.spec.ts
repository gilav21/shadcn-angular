import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DockComponent, DockItemData } from './dock.component';
import { DockItemComponent } from './sub/dock-item.component';
import { DockIconComponent } from './sub/dock-icon.component';
import { DockLabelComponent } from './sub/dock-label.component';
import { Component, ViewChild, signal } from '@angular/core';
import { By } from '@angular/platform-browser';

function makeRect(x: number): DOMRect {
    return {
        x, y: 0, width: 40, height: 40,
        top: 0, left: x, right: x + 40, bottom: 40,
        toJSON: () => undefined,
    } as unknown as DOMRect;
}

/** Two frames, not one: the component schedules its own frame while handling
 *  the event, so a single `requestAnimationFrame` can resolve before it runs. */
function makeVerticalRect(y: number): DOMRect {
    return {
        x: 0, y, width: 40, height: 40,
        top: y, left: 0, right: 40, bottom: y + 40,
        toJSON: () => undefined,
    } as unknown as DOMRect;
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

@Component({
    template: `
    <ui-dock [magnification]="magnification" [distance]="distance">
      <ui-dock-item>
        <ui-dock-label>Item 1</ui-dock-label>
        <ui-dock-icon>Icon 1</ui-dock-icon>
      </ui-dock-item>
      <ui-dock-item>
        <ui-dock-label>Item 2</ui-dock-label>
        <ui-dock-icon>Icon 2</ui-dock-icon>
      </ui-dock-item>
    </ui-dock>
  `,
    imports: [DockComponent, DockItemComponent, DockIconComponent, DockLabelComponent]
})
class CustomModeHostComponent {
    magnification = 80;
    distance = 100;
    @ViewChild(DockComponent) dockComponent!: DockComponent;
}

@Component({
    template: `<ui-dock [items]="items()" [magnification]="60" [distance]="100" [position]="position()" />`,
    imports: [DockComponent]
})
class SimpleModeHostComponent {
    items = signal<DockItemData[]>([
        { label: 'Home', icon: 'H' },
        { label: 'Settings', icon: 'S', active: true },
        { label: 'Profile', icon: 'P', class: 'custom-class' },
    ]);
    position = signal<'bottom' | 'top' | 'left' | 'right'>('bottom');
    @ViewChild(DockComponent) dockComponent!: DockComponent;
}

describe('DockComponent', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * Give each item a fixed rect as an *own* property rather than through an
     * `Element.prototype` stub. The prototype is shared state: whenever the stub
     * is not in effect at the moment `DockItemComponent` measures, it reads live
     * layout instead (every item at the same x), the magnified width never
     * appears, and the wait below times out. An own property shadows the
     * prototype regardless of ordering and dies with the element, so it cannot
     * leak into another file.
     */
    function layoutItems(items: HTMLElement[]): void {
        items.forEach((el, index) => {
            const rect = makeRect(index * 50);
            Object.defineProperty(el, 'getBoundingClientRect', {
                configurable: true,
                value: () => rect,
            });
        });
    }

    describe('Custom Mode (Content Projection)', () => {
        let component: CustomModeHostComponent;
        let fixture: ComponentFixture<CustomModeHostComponent>;
        let dockComponent: DockComponent;
        let dockEl: HTMLElement;
        let itemEls: HTMLElement[];

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [CustomModeHostComponent]
            }).compileComponents();

            fixture = TestBed.createComponent(CustomModeHostComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
            dockComponent = component.dockComponent;
            dockEl = fixture.debugElement.query(By.directive(DockComponent)).nativeElement;
            itemEls = fixture.debugElement
                .queryAll(By.directive(DockItemComponent))
                .map(d => d.nativeElement as HTMLElement);
            layoutItems(itemEls);
            dockComponent.recalculateItemCenters();
        });

        it('should detect custom content', () => {
            expect(dockComponent.hasCustomContent()).toBe(true);
        });

        it('should render projected dock items', () => {
            const bar = fixture.debugElement.query(By.css('[data-slot="dock"]')).nativeElement as HTMLElement;
            expect(bar.textContent).toContain('Icon 1');
            expect(bar.textContent).toContain('Icon 2');
        });

        it('should magnify item under the pointer via a real mousemove event', async () => {
            dockEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            dockEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 0, bubbles: true }));
            // Wait for the widths the mousemove produces rather than a fixed
            // number of frames. The component applies them from its own
            // animation frame, so any fixed count is a bet on how promptly the
            // browser schedules it — under load the frame lands after the wait
            // and the item is still at its 40px base width.
            await vi.waitFor(() =>
                expect(Number.parseFloat(itemEls[0].style.width)).toBeCloseTo(80, 5));

            expect(Number.parseFloat(itemEls[0].style.width)).toBeCloseTo(80, 5);
            const neighbour = Number.parseFloat(itemEls[1].style.width);
            expect(neighbour).toBeGreaterThan(40);
            expect(neighbour).toBeLessThan(80);
        });

        it('should leave items at base width when pointer is far away', async () => {
            dockEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000, clientY: 0, bubbles: true }));
            await nextFrame();

            expect(itemEls[0].style.width).toBe('40px');
            expect(itemEls[1].style.width).toBe('40px');
        });

        it('should coalesce rapid mousemoves into a single frame', async () => {
            const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
            dockEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, bubbles: true }));
            dockEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 70, bubbles: true }));
            expect(rafSpy).toHaveBeenCalledTimes(1);

            // The one frame uses the last pointer position: item 1 (centre 70) peaks.
            await vi.waitFor(() =>
                expect(Number.parseFloat(itemEls[1].style.width)).toBeCloseTo(80, 5));
            expect(Number.parseFloat(itemEls[0].style.width)).toBeLessThan(80);
        });

        it('should reset item widths on mouseleave', () => {
            itemEls[0].style.width = '80px';
            dockEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            expect(itemEls[0].style.width).toBe('40px');
        });

        it('should cancel a pending frame on mouseleave', async () => {
            // A stale frame would recompute with the pointer already gone, so it
            // leaves no trace in the widths; the cancellation is the contract.
            const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
            const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
            dockEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, bubbles: true }));
            const pending = rafSpy.mock.results[0].value;
            dockEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

            expect(cancelSpy).toHaveBeenCalledWith(pending);
            await nextFrame();
            expect(itemEls[0].style.width).toBe('40px');
            expect(itemEls[1].style.width).toBe('40px');
        });

        it('should recalculate centers on mouseenter', async () => {
            // Item 0 has moved since the dock last measured it.
            const moved = makeRect(500);
            Object.defineProperty(itemEls[0], 'getBoundingClientRect', { configurable: true, value: () => moved });

            dockEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            dockEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 520, bubbles: true }));

            await vi.waitFor(() =>
                expect(Number.parseFloat(itemEls[0].style.width)).toBeCloseTo(80, 5));
        });

        it('should cancel a pending frame on destroy', async () => {
            dockEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, bubbles: true }));
            fixture.destroy();
            await nextFrame();

            expect(itemEls[0].style.width).toBe('40px');
            expect(itemEls[1].style.width).toBe('40px');
        });
    });

    describe('Simple Mode (Data-Driven)', () => {
        let component: SimpleModeHostComponent;
        let fixture: ComponentFixture<SimpleModeHostComponent>;
        let dockComponent: DockComponent;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [SimpleModeHostComponent]
            }).compileComponents();

            fixture = TestBed.createComponent(SimpleModeHostComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
            dockComponent = component.dockComponent;
        });

        it('should render labels from item data', () => {
            const labels = fixture.debugElement.queryAll(By.directive(DockLabelComponent));
            expect(labels).toHaveLength(3);
            expect(labels[0].nativeElement.textContent.trim()).toBe('Home');
            expect(labels[1].nativeElement.textContent.trim()).toBe('Settings');
        });

        it('should render icons from item data', () => {
            const icons = fixture.debugElement.queryAll(By.directive(DockIconComponent));
            expect(icons).toHaveLength(3);
            expect(icons[0].nativeElement.textContent.trim()).toBe('H');
        });

        it('should apply active state from item data', () => {
            const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));
            const activeIndicator = items[1].query(By.css(String.raw`.bg-foreground\/50`));
            expect(activeIndicator).toBeTruthy();
        });

        it('should apply custom class from item data', () => {
            const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));
            expect(items[2].nativeElement.className).toContain('custom-class');
        });

        it('should magnify along the column in a vertical dock', async () => {
            component.position.set('left');
            fixture.detectChanges();

            const itemEls = fixture.debugElement
                .queryAll(By.directive(DockItemComponent))
                .map(d => d.nativeElement as HTMLElement);
            itemEls.forEach((el, index) => {
                const rect = makeVerticalRect(index * 50);
                Object.defineProperty(el, 'getBoundingClientRect', { configurable: true, value: () => rect });
            });
            dockComponent.recalculateItemCenters();

            const dockEl = fixture.debugElement.query(By.css('[data-slot="dock"]')).nativeElement as HTMLElement;
            dockEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 120, bubbles: true }));

            await vi.waitFor(() =>
                expect(Number.parseFloat(itemEls[2].style.width)).toBeCloseTo(60, 5));
            expect(Number.parseFloat(itemEls[0].style.width)).toBe(40);
        });

        it('should render a link for an item with an href', () => {
            component.items.set([{ label: 'Docs', icon: 'D', href: '/docs' }]);
            fixture.detectChanges();

            const link = fixture.debugElement.query(By.css('[data-slot="dock-item-link"]'));
            expect(link).toBeTruthy();
            expect((link.nativeElement as HTMLAnchorElement).getAttribute('href')).toBe('/docs');
            expect((link.nativeElement as HTMLAnchorElement).getAttribute('aria-label')).toBe('Docs');
        });

        it('should render a button that runs onClick for an item without an href', () => {
            let clicked = 0;
            component.items.set([{ label: 'Launch', icon: 'L', onClick: () => clicked++ }]);
            fixture.detectChanges();

            const button = fixture.debugElement.query(By.css('[data-slot="dock-item-button"]'));
            expect(button).toBeTruthy();
            (button.nativeElement as HTMLButtonElement).click();
            expect(clicked).toBe(1);
        });

        it('should run onClick from a link as well as navigating', () => {
            let clicked = 0;
            component.items.set([{ label: 'Both', icon: 'B', href: '#dock-target', onClick: () => clicked++ }]);
            fixture.detectChanges();

            const link = fixture.debugElement.query(By.css('[data-slot="dock-item-link"]'));
            link.triggerEventHandler('click', new MouseEvent('click'));
            expect(clicked).toBe(1);
        });

        it('should stay decorative for an item with neither href nor onClick', () => {
            component.items.set([{ label: 'Plain', icon: 'P' }]);
            fixture.detectChanges();

            expect(fixture.debugElement.query(By.css('[data-slot="dock-item-link"]'))).toBeNull();
            expect(fixture.debugElement.query(By.css('[data-slot="dock-item-button"]'))).toBeNull();
        });

        it('should skip items without a matching center', async () => {
            const itemEls = () => fixture.debugElement
                .queryAll(By.directive(DockItemComponent))
                .map(d => d.nativeElement as HTMLElement);
            itemEls().forEach((el, index) => {
                const rect = makeRect(index * 50);
                Object.defineProperty(el, 'getBoundingClientRect', { configurable: true, value: () => rect });
            });
            dockComponent.recalculateItemCenters();

            // Added after the last measurement, with no mouseenter to re-measure.
            component.items.update(items => [...items, { label: 'Late', icon: 'L' }]);
            fixture.detectChanges();
            const late = itemEls()[3];

            const dockEl = fixture.debugElement.query(By.directive(DockComponent)).nativeElement as HTMLElement;
            dockEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, bubbles: true }));

            await vi.waitFor(() =>
                expect(Number.parseFloat(itemEls()[2].style.width)).toBeCloseTo(60, 5));
            expect(late.style.width).toBe('40px');
        });

        it('should no-op updateItems when there are no items', () => {
            component.items.set([]);
            fixture.detectChanges();
            const spy = vi.spyOn(dockComponent, 'updateItems');
            dockComponent.updateItems();
            expect(spy).toHaveReturned();
        });
    });
});
