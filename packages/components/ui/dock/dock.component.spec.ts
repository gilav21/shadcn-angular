import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DockComponent, DockItemData } from './dock.component';
import { DockItemComponent } from './sub/dock-item.component';
import { DockIconComponent } from './sub/dock-icon.component';
import { DockLabelComponent } from './sub/dock-label.component';
import { Component, ViewChild, signal } from '@angular/core';
import { By } from '@angular/platform-browser';

type RectProto = { getBoundingClientRect: () => DOMRect };
type DockInternals = {
    _itemCenters: number[];
    _rafId: number | null;
    _mouseX: number;
};

function makeRect(x: number): DOMRect {
    return {
        x, y: 0, width: 40, height: 40,
        top: 0, left: x, right: x + 40, bottom: 40,
        toJSON: () => undefined,
    } as unknown as DOMRect;
}

/** Two frames, not one: the component schedules its own frame while handling
 *  the event, so a single `requestAnimationFrame` can resolve before it runs. */
function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function internals(dock: DockComponent): DockInternals {
    return dock as unknown as DockInternals;
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
    const originalRect = Element.prototype.getBoundingClientRect;

    afterEach(() => {
        (Element.prototype as unknown as RectProto).getBoundingClientRect = originalRect;
        vi.restoreAllMocks();
    });

    function layoutItems(items: HTMLElement[]): void {
        const rects = new Map<Element, DOMRect>();
        items.forEach((el, index) => rects.set(el, makeRect(index * 50)));
        (Element.prototype as unknown as RectProto).getBoundingClientRect = function (this: Element): DOMRect {
            return rects.get(this) ?? originalRect.call(this);
        };
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

        it('should create', () => {
            expect(component).toBeTruthy();
            expect(dockComponent).toBeTruthy();
        });

        it('should detect custom content', () => {
            expect(dockComponent.hasCustomContent()).toBe(true);
        });

        it('should render projected dock items', () => {
            expect(itemEls).toHaveLength(2);
        });

        it('should have data-slot on dock root', () => {
            const el = fixture.debugElement.query(By.css('[data-slot="dock"]'));
            expect(el).toBeTruthy();
        });

        it('should have default inputs', () => {
            expect(dockComponent.magnification()).toBe(80);
            expect(dockComponent.distance()).toBe(100);
        });

        it('should magnify item under the pointer via a real mousemove event', async () => {
            dockEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            dockEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 0, bubbles: true }));
            await nextFrame();

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
            dockComponent.onMouseMove(new MouseEvent('mousemove', { clientX: 20 }));
            expect(internals(dockComponent)._rafId).not.toBeNull();
            dockComponent.onMouseMove(new MouseEvent('mousemove', { clientX: 70 }));
            expect(internals(dockComponent)._mouseX).toBe(70);
            await nextFrame();
            expect(internals(dockComponent)._rafId).toBeNull();
        });

        it('should reset item widths on mouseleave', () => {
            itemEls[0].style.width = '80px';
            dockEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            expect(itemEls[0].style.width).toBe('40px');
        });

        it('should cancel a pending frame on mouseleave', () => {
            const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
            dockComponent.onMouseMove(new MouseEvent('mousemove', { clientX: 20 }));
            dockComponent.onMouseLeave();
            expect(cancelSpy).toHaveBeenCalled();
            expect(internals(dockComponent)._rafId).toBeNull();
        });

        it('should recalculate centers on mouseenter', () => {
            const spy = vi.spyOn(dockComponent, 'recalculateItemCenters');
            dockComponent.onMouseEnter();
            expect(spy).toHaveBeenCalled();
        });

        it('should skip items without a matching center', () => {
            internals(dockComponent)._itemCenters = [];
            internals(dockComponent)._mouseX = 20;
            dockComponent.updateItems();
            expect(itemEls[0].style.width).toBe('40px');
        });

        it('should cancel a pending frame on destroy', () => {
            const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
            dockComponent.onMouseMove(new MouseEvent('mousemove', { clientX: 20 }));
            expect(internals(dockComponent)._rafId).not.toBeNull();
            fixture.destroy();
            expect(cancelSpy).toHaveBeenCalled();
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

        it('should not detect custom content', () => {
            expect(dockComponent.hasCustomContent()).toBe(false);
        });

        it('should render items from data input', () => {
            const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));
            expect(items).toHaveLength(3);
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

        it('should render the bottom position variant by default', () => {
            const dockEl = fixture.debugElement.query(By.css('[data-slot="dock"]'));
            expect(dockEl.nativeElement.className).toContain('items-end');
        });

        it('should render the top position variant', () => {
            component.position.set('top');
            fixture.detectChanges();
            const dockEl = fixture.debugElement.query(By.css('[data-slot="dock"]'));
            expect(dockEl.nativeElement.className).toContain('items-start');
        });

        it('should render vertical (left/right) position variants as a column', () => {
            component.position.set('left');
            fixture.detectChanges();
            let dockEl = fixture.debugElement.query(By.css('[data-slot="dock"]'));
            expect(dockEl.nativeElement.className).toContain('flex-col');

            component.position.set('right');
            fixture.detectChanges();
            dockEl = fixture.debugElement.query(By.css('[data-slot="dock"]'));
            expect(dockEl.nativeElement.className).toContain('flex-col');
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
