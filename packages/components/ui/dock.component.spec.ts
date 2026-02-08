import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DockComponent } from './dock.component';
import { DockItemComponent } from './dock-item.component';
import { DockIconComponent } from './dock-icon.component';
import { DockLabelComponent } from './dock-label.component';
import { Component, ViewChild } from '@angular/core';
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
    standalone: true,
    imports: [DockComponent, DockItemComponent, DockIconComponent, DockLabelComponent]
})
class TestHostComponent {
    magnification = 80;
    distance = 100;
    @ViewChild(DockComponent) dockComponent!: DockComponent;
}

describe('DockComponent', () => {
    let component: TestHostComponent;
    let fixture: ComponentFixture<TestHostComponent>;
    let dockComponent: DockComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, DockComponent, DockItemComponent, DockIconComponent, DockLabelComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        dockComponent = component.dockComponent;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
        expect(dockComponent).toBeTruthy();
    });

    it('should render dock items', () => {
        const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));
        expect(items.length).toBe(2);
    });

    it('should have default inputs', () => {
        // defaults set in component: magnification=60, distance=140
        // host component overrides them to 80 and 100
        expect(dockComponent.magnification()).toBe(80);
        expect(dockComponent.distance()).toBe(100);
    });

    it('should update item widths on mousemove', async () => {
        const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));

        // Mock getBoundingClientRect for items to have known positions
        const rect1 = {
            x: 0,
            y: 0,
            width: 40,
            height: 40,
            top: 0,
            left: 0,
            right: 40,
            bottom: 40,
            toJSON: () => { }
        } as DOMRect;

        const rect2 = {
            x: 40,
            y: 0,
            width: 40,
            height: 40,
            top: 0,
            left: 40,
            right: 80,
            bottom: 40,
            toJSON: () => { }
        } as DOMRect;

        vi.spyOn(items[0].nativeElement, 'getBoundingClientRect').mockReturnValue(rect1);
        vi.spyOn(items[1].nativeElement, 'getBoundingClientRect').mockReturnValue(rect2);

        // Recalculate centers with new mocks
        dockComponent.recalculateItemCenters();

        // Mouse at 20 (center of item 1)
        const event = new MouseEvent('mousemove', {
            clientX: 20,
            bubbles: true
        });

        dockComponent.onMouseMove(event);

        // Wait for RAF
        await new Promise(resolve => requestAnimationFrame(resolve));

        const item1Style = items[0].nativeElement.style.width;
        // Should be > 40
        expect(item1Style).toBeTruthy();
        const widthVal = parseFloat(item1Style);
        expect(widthVal).toBeGreaterThan(40);
        expect(widthVal).toBeLessThanOrEqual(80);
    });

    it('should reset item widths on mouseleave', async () => {
        const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));

        // Force width update first
        items[0].nativeElement.style.width = '80px';

        // Trigger mouse leave
        dockComponent.onMouseLeave();

        // Should return to base width (40px)
        const item1Style = items[0].nativeElement.style.width;
        expect(item1Style).toBe('40px');
    });
});
