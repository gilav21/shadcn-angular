import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import {
    ResizablePanelGroupComponent,
    ResizablePanelComponent,
    ResizableHandleComponent
} from './resizable.component';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

@Component({
    template: `
    <ui-resizable-panel-group [direction]="direction()">
      <ui-resizable-panel [defaultSize]="50" class="panel-a">Left</ui-resizable-panel>
      <ui-resizable-handle></ui-resizable-handle>
      <ui-resizable-panel [defaultSize]="50" class="panel-b">Right</ui-resizable-panel>
    </ui-resizable-panel-group>
  `,
    imports: [ResizablePanelGroupComponent, ResizablePanelComponent, ResizableHandleComponent]
})
class TestHostComponent {
    direction = signal<'horizontal' | 'vertical'>('horizontal');
}

@Component({
    template: `
    <div [dir]="dir()">
      <ui-resizable-panel-group direction="horizontal">
        <ui-resizable-panel [defaultSize]="50" class="panel-a">Start</ui-resizable-panel>
        <ui-resizable-handle></ui-resizable-handle>
        <ui-resizable-panel [defaultSize]="50" class="panel-b">End</ui-resizable-panel>
      </ui-resizable-panel-group>
    </div>
  `,
    imports: [ResizablePanelGroupComponent, ResizablePanelComponent, ResizableHandleComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('ResizableComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    // Helper to mock layout
    const mockLayout = (element: HTMLElement, size: number) => {
        Object.defineProperty(element, 'offsetWidth', { configurable: true, value: size });
        Object.defineProperty(element, 'offsetHeight', { configurable: true, value: size });
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable(); // For initial setTimeout in panel
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should set initial sizes', () => {
        const panels = fixture.debugElement.queryAll(By.directive(ResizablePanelComponent));
        expect(panels[0].nativeElement.style.flexBasis).toBe('50%');
        expect(panels[1].nativeElement.style.flexBasis).toBe('50%');
    });

    it('should resize horizontal panels on drag', () => {
        const group = fixture.debugElement.query(By.css('[data-slot="resizable-panel-group"]')).nativeElement;
        mockLayout(group, 1000); // 1000px width

        const panels = fixture.debugElement.queryAll(By.directive(ResizablePanelComponent));
        mockLayout(panels[0].nativeElement, 500);
        mockLayout(panels[1].nativeElement, 500);

        const handle = fixture.debugElement.query(By.directive(ResizableHandleComponent));

        const handleEl = handle.query(By.css('[data-slot="resizable-handle"]'));

        // Start drag at 500px
        handleEl.triggerEventHandler('mousedown', {
            preventDefault: () => { },
            clientX: 500,
            clientY: 0
        });

        // Move to 600px (delta +100px -> +10%)
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600, clientY: 0 }));
        fixture.detectChanges();

        // Panel A should grow to 60%, Panel B shrink to 40%
        expect(panels[0].nativeElement.style.flexBasis).toBe('60%');
        expect(panels[1].nativeElement.style.flexBasis).toBe('40%');

        document.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('should resize vertical panels on drag', async () => {
        component.direction.set('vertical');
        fixture.detectChanges();
        await fixture.whenStable();

        const group = fixture.debugElement.query(By.css('[data-slot="resizable-panel-group"]')).nativeElement;
        mockLayout(group, 1000); // 1000px height

        const panels = fixture.debugElement.queryAll(By.directive(ResizablePanelComponent));
        mockLayout(panels[0].nativeElement, 500);
        mockLayout(panels[1].nativeElement, 500);

        const handle = fixture.debugElement.query(By.directive(ResizableHandleComponent));

        const handleEl = handle.query(By.css('[data-slot="resizable-handle"]'));

        // Start drag at 500px
        handleEl.triggerEventHandler('mousedown', {
            preventDefault: () => { },
            clientX: 0,
            clientY: 500
        });

        // Move to 600px (delta +100px -> +10%)
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 600 }));
        fixture.detectChanges();

        // Panel A should grow to 60%, Panel B shrink to 40%
        expect(panels[0].nativeElement.style.flexBasis).toBe('60%');
        expect(panels[1].nativeElement.style.flexBasis).toBe('40%');

        document.dispatchEvent(new MouseEvent('mouseup'));
    });
});

describe('Resizable RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;

    // Helper to mock layout
    const mockLayout = (element: HTMLElement, size: number) => {
        Object.defineProperty(element, 'offsetWidth', { configurable: true, value: size });
        Object.defineProperty(element, 'offsetHeight', { configurable: true, value: size });
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    it('should resize in RTL direction', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl'); // Important for getComputedStyle
        fixture.detectChanges();

        const group = fixture.debugElement.query(By.css('[data-slot="resizable-panel-group"]')).nativeElement;
        mockLayout(group, 1000);

        const panels = fixture.debugElement.queryAll(By.directive(ResizablePanelComponent));
        mockLayout(panels[0].nativeElement, 500);
        mockLayout(panels[1].nativeElement, 500);

        const handle = fixture.debugElement.query(By.directive(ResizableHandleComponent));

        const handleEl = handle.query(By.css('[data-slot="resizable-handle"]'));

        // Start drag at 500px
        handleEl.triggerEventHandler('mousedown', {
            preventDefault: () => { },
            clientX: 500,
            clientY: 0
        });

        // Move to 400px (visually LEFT in RTL means increasing first panel?)
        // Wait, standard RTL:
        // [Panel A] [Handle] [Panel B]
        // Panel A is on Right? 
        // No, Flex RTL: A is Right, B is Left.
        // If I move handle Left (clientX decreases), Panel A (Right) grows?
        // Let's check logic: delta = clientX - startX.
        // If clientX 500 -> 400, delta = -100.
        // Logic: if (isHorizontal && isRtl) delta = -delta; => delta = 100.
        // newSizeBefore (Panel A) = 500 + 100 = 600.
        // So moving Left (-100px) increases Panel A by 100px.
        // This is correct behavior for RTL if Panel A is the "start" (Right side).

        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 0 }));
        fixture.detectChanges();

        // Panel A should grow to 60%
        expect(panels[0].nativeElement.style.flexBasis).toBe('60%');

        document.dispatchEvent(new MouseEvent('mouseup'));
    });
});
