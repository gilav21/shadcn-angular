import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DockComponent, DockItemData } from './dock.component';
import { DockItemComponent } from './dock-item.component';
import { DockIconComponent } from './dock-icon.component';
import { DockLabelComponent } from './dock-label.component';
import { Component, ViewChild, signal } from '@angular/core';
import { By } from '@angular/platform-browser';

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
    template: `
    <ui-dock [items]="items()" [magnification]="60" [distance]="100" />
  `,
    imports: [DockComponent]
})
class SimpleModeHostComponent {
    items = signal<DockItemData[]>([
        { label: 'Home', icon: 'H' },
        { label: 'Settings', icon: 'S', active: true },
        { label: 'Profile', icon: 'P', class: 'custom-class' },
    ]);
    @ViewChild(DockComponent) dockComponent!: DockComponent;
}

describe('DockComponent', () => {
    describe('Custom Mode (Content Projection)', () => {
        let component: CustomModeHostComponent;
        let fixture: ComponentFixture<CustomModeHostComponent>;
        let dockComponent: DockComponent;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [CustomModeHostComponent]
            }).compileComponents();

            fixture = TestBed.createComponent(CustomModeHostComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
            dockComponent = component.dockComponent;
        });

        it('should create', () => {
            expect(component).toBeTruthy();
            expect(dockComponent).toBeTruthy();
        });

        it('should detect custom content', () => {
            expect(dockComponent.hasCustomContent()).toBe(true);
        });

        it('should render projected dock items', () => {
            const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));
            expect(items.length).toBe(2);
        });

        it('should have data-slot on dock root', () => {
            const dockEl = fixture.debugElement.query(By.css('[data-slot="dock"]'));
            expect(dockEl).toBeTruthy();
        });

        it('should have default inputs', () => {
            expect(dockComponent.magnification()).toBe(80);
            expect(dockComponent.distance()).toBe(100);
        });

        it('should update item widths on mousemove', async () => {
            const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));

            const rect1 = {
                x: 0, y: 0, width: 40, height: 40,
                top: 0, left: 0, right: 40, bottom: 40,
                toJSON: () => { }
            } as DOMRect;

            const rect2 = {
                x: 40, y: 0, width: 40, height: 40,
                top: 0, left: 40, right: 80, bottom: 40,
                toJSON: () => { }
            } as DOMRect;

            vi.spyOn(items[0].nativeElement, 'getBoundingClientRect').mockReturnValue(rect1);
            vi.spyOn(items[1].nativeElement, 'getBoundingClientRect').mockReturnValue(rect2);

            dockComponent.recalculateItemCenters();

            const event = new MouseEvent('mousemove', {
                clientX: 20,
                bubbles: true
            });

            dockComponent.onMouseMove(event);

            await new Promise(resolve => requestAnimationFrame(resolve));

            const item1Style = items[0].nativeElement.style.width;
            expect(item1Style).toBeTruthy();
            const widthVal = parseFloat(item1Style);
            expect(widthVal).toBeGreaterThan(40);
            expect(widthVal).toBeLessThanOrEqual(80);
        });

        it('should reset item widths on mouseleave', async () => {
            const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));

            items[0].nativeElement.style.width = '80px';

            dockComponent.onMouseLeave();

            const item1Style = items[0].nativeElement.style.width;
            expect(item1Style).toBe('40px');
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

        it('should create', () => {
            expect(component).toBeTruthy();
            expect(dockComponent).toBeTruthy();
        });

        it('should not detect custom content', () => {
            expect(dockComponent.hasCustomContent()).toBe(false);
        });

        it('should render items from data input', () => {
            const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));
            expect(items.length).toBe(3);
        });

        it('should render labels from item data', () => {
            const labels = fixture.debugElement.queryAll(By.directive(DockLabelComponent));
            expect(labels.length).toBe(3);
            expect(labels[0].nativeElement.textContent.trim()).toBe('Home');
            expect(labels[1].nativeElement.textContent.trim()).toBe('Settings');
        });

        it('should render icons from item data', () => {
            const icons = fixture.debugElement.queryAll(By.directive(DockIconComponent));
            expect(icons.length).toBe(3);
            expect(icons[0].nativeElement.textContent.trim()).toBe('H');
        });

        it('should apply active state from item data', () => {
            const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));
            const activeIndicator = items[1].query(By.css('.bg-foreground\\/50'));
            expect(activeIndicator).toBeTruthy();
        });

        it('should apply custom class from item data', () => {
            const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));
            expect(items[2].nativeElement.className).toContain('custom-class');
        });

        it('should apply position variant classes', () => {
            fixture.componentRef.setInput('items', component.items());

            const dockEl = fixture.debugElement.query(By.css('[data-slot="dock"]'));
            expect(dockEl.nativeElement.className).toContain('items-end');
        });
    });
});
