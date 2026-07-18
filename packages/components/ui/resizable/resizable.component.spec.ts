import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import {
    ResizablePanelGroupComponent,
    ResizablePanelComponent,
    ResizableHandleComponent
} from './index';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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

    it('should resize horizontal panels on touch drag', () => {
        const group = fixture.debugElement.query(By.css('[data-slot="resizable-panel-group"]')).nativeElement;
        mockLayout(group, 1000);

        const panels = fixture.debugElement.queryAll(By.directive(ResizablePanelComponent));
        mockLayout(panels[0].nativeElement, 500);
        mockLayout(panels[1].nativeElement, 500);

        const handle = fixture.debugElement.query(By.directive(ResizableHandleComponent));
        const handleEl = handle.query(By.css('[data-slot="resizable-handle"]'));

        handleEl.triggerEventHandler('touchstart', {
            preventDefault: () => { },
            touches: [{ clientX: 500, clientY: 0 }]
        });

        const move = new Event('touchmove', { bubbles: true, cancelable: true });
        (move as unknown as { touches: { clientX: number; clientY: number }[] }).touches = [{ clientX: 600, clientY: 0 }];
        document.dispatchEvent(move);
        fixture.detectChanges();

        expect(panels[0].nativeElement.style.flexBasis).toBe('60%');
        expect(panels[1].nativeElement.style.flexBasis).toBe('40%');

        document.dispatchEvent(new Event('touchend', { bubbles: true }));
    });

    it('should ignore multi-touch start', () => {
        const handle = fixture.debugElement.query(By.directive(ResizableHandleComponent));
        const handleEl = handle.query(By.css('[data-slot="resizable-handle"]'));

        handleEl.triggerEventHandler('touchstart', {
            preventDefault: () => { },
            touches: [{ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 10 }]
        });

        const panels = fixture.debugElement.queryAll(By.directive(ResizablePanelComponent));
        expect(panels[0].nativeElement.style.flexBasis).toBe('50%');
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
        // isRtl() reads getComputedStyle(el).direction; jsdom doesn't cascade
        // `dir` into computed direction across runners, so reflect the nearest
        // [dir] ancestor here (what a real browser resolves).
        const originalGetComputedStyle = globalThis.getComputedStyle;
        globalThis.getComputedStyle = ((el: Element, pseudo?: string | null) => {
            const real = originalGetComputedStyle(el, pseudo ?? undefined);
            const dir = (el as HTMLElement).closest?.('[dir]')?.getAttribute('dir');
            if (!dir) return real;
            return new Proxy(real, {
                get: (target, prop) => (prop === 'direction' ? dir : Reflect.get(target, prop)),
            });
        }) as typeof getComputedStyle;
        try {
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
        } finally {
            globalThis.getComputedStyle = originalGetComputedStyle;
            document.documentElement.removeAttribute('dir');
        }
    });
});

@Component({
    template: `
    <ui-resizable-panel-group direction="horizontal">
      <ui-resizable-panel [defaultSize]="50">A</ui-resizable-panel>
      <ui-resizable-handle [withHandle]="true"></ui-resizable-handle>
      <ui-resizable-panel [defaultSize]="50">B</ui-resizable-panel>
    </ui-resizable-panel-group>
    <ui-resizable-panel-group direction="vertical">
      <ui-resizable-panel [defaultSize]="50">C</ui-resizable-panel>
      <ui-resizable-handle [withHandle]="true"></ui-resizable-handle>
      <ui-resizable-panel [defaultSize]="50">D</ui-resizable-panel>
    </ui-resizable-panel-group>
  `,
    imports: [ResizablePanelGroupComponent, ResizablePanelComponent, ResizableHandleComponent]
})
class WithHandleHostComponent { }

describe('Resizable grip/handle rendering', () => {
    let fixture: ComponentFixture<WithHandleHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [WithHandleHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(WithHandleHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('renders grips in both orientations with detected direction styles', () => {
        const handles = fixture.debugElement.queryAll(By.css('[data-slot="resizable-handle"]'));
        expect(handles).toHaveLength(2);

        const horizontal = handles[0].nativeElement as HTMLElement;
        const vertical = handles[1].nativeElement as HTMLElement;

        expect(horizontal.getAttribute('style')).toContain('width');
        expect(vertical.getAttribute('style')).toContain('height');

        const svgs = fixture.debugElement.queryAll(By.css('svg'));
        expect(svgs).toHaveLength(2);
        const verticalSvgClass = svgs[1].nativeElement.getAttribute('class') ?? '';
        expect(verticalSvgClass).toContain('rotate-90');
    });
});

@Component({
    template: `<ui-resizable-handle></ui-resizable-handle>`,
    imports: [ResizableHandleComponent]
})
class NoGroupHostComponent { }

@Component({
    template: `
    <ui-resizable-panel-group direction="horizontal">
      <ui-resizable-handle></ui-resizable-handle>
    </ui-resizable-panel-group>
  `,
    imports: [ResizablePanelGroupComponent, ResizableHandleComponent]
})
class NoPanelsHostComponent { }

describe('Resizable drag guards', () => {
    const triggerDrag = (fixture: ComponentFixture<unknown>) => {
        const handleEl = fixture.debugElement.query(By.css('[data-slot="resizable-handle"]'));
        handleEl.triggerEventHandler('mousedown', {
            preventDefault: () => { },
            clientX: 0,
            clientY: 0
        });
    };

    it('does nothing when the handle has no panel group ancestor', async () => {
        await TestBed.configureTestingModule({ imports: [NoGroupHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(NoGroupHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();

        triggerDrag(fixture);
        expect(document.body.style.cursor).toBe('');
    });

    it('does nothing when there are no adjacent panels', async () => {
        await TestBed.configureTestingModule({ imports: [NoPanelsHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(NoPanelsHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();

        triggerDrag(fixture);
        expect(document.body.style.cursor).toBe('');
    });
});

describe('ResizablePanel updateSize', () => {
    it('updates its size and emits the change', async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();

        const panel = fixture.debugElement.query(By.directive(ResizablePanelComponent))
            .componentInstance as ResizablePanelComponent;

        let emitted = 0;
        panel.sizeChange.subscribe((v: number) => (emitted = v));
        panel.updateSize(72);
        fixture.detectChanges();

        expect(panel.size()).toBe(72);
        expect(emitted).toBe(72);
        expect(panel.el.nativeElement.style.flexBasis).toBe('72%');
    });
});
