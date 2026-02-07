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
        // defaults set in component: magnification=60, distance=100
        // host component overrides them to 80 and 100
        expect(dockComponent.magnification()).toBe(80);
        expect(dockComponent.distance()).toBe(100);
    });

    it('should update mouseX signal on mousemove', () => {
        const dockEl = fixture.debugElement.query(By.css('ui-dock > div')); // The container div inside the component

        // Simulate mouse move
        const event = new MouseEvent('mousemove', {
            clientX: 500,
            clientY: 100,
            bubbles: true
        });

        dockEl.nativeElement.dispatchEvent(event);
        fixture.detectChanges();

        expect(dockComponent.mouseX()).toBe(500);
    });

    it('should reset mouseX signal on mouseleave', () => {
        const dockEl = fixture.debugElement.query(By.css('ui-dock > div'));

        // First move mouse
        dockComponent.mouseX.set(500);
        fixture.detectChanges();
        expect(dockComponent.mouseX()).toBe(500);

        // Then leave
        const event = new MouseEvent('mouseleave', { bubbles: true });
        dockEl.nativeElement.dispatchEvent(event);
        fixture.detectChanges();

        expect(dockComponent.mouseX()).toBe(Infinity);
    });

    it('should calculate width for items', () => {
        const items = fixture.debugElement.queryAll(By.directive(DockItemComponent));
        const firstItem = items[0].componentInstance as DockItemComponent;

        // Mock getBoundingClientRect
        vi.spyOn(items[0].nativeElement, 'getBoundingClientRect').mockReturnValue({
            x: 100,
            width: 40,
            height: 40,
            top: 0,
            left: 100,
            right: 140,
            bottom: 40
        } as DOMRect);

        // Initial state (mouse infinite)
        expect(firstItem.width()).toBe(40); // Base width

        // Move mouse close to item (center is 120)
        // Distance is 100
        // Mouse at 120 -> dist 0 -> max magnification

        dockComponent.mouseX.set(120);
        fixture.detectChanges();

        // Should be at max magnification (80)
        expect(firstItem.width()).toBeCloseTo(80, 0);

        // Move mouse away
        dockComponent.mouseX.set(1000); // Far away
        fixture.detectChanges();

        expect(firstItem.width()).toBe(40);
    });
});
