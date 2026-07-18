import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChartBrushComponent, BrushSelection } from './chart-brush.component';

/**
 * Portable jsdom coverage for the DOM event handlers (localX/pointerToSvg
 * plumbing, mouse + touch down handlers, and the window-level move/up
 * listeners) plus the pure early-return guards. getBoundingClientRect is
 * stubbed on Element.prototype so the SVG maps client pixels 1:1 to user space
 * (rect left=0/width=400 and viewBox width=400), and restored in afterEach.
 */
describe('ChartBrushComponent DOM handlers', () => {
    let component: ChartBrushComponent;
    let fixture: ComponentFixture<ChartBrushComponent>;
    let originalGBCR: PropertyDescriptor | undefined;

    const stubRect = {
        top: 0, left: 0, right: 400, bottom: 100,
        width: 400, height: 100, x: 0, y: 0,
        toJSON() { /* jsdom DOMRect shim */ },
    };

    beforeEach(async () => {
        originalGBCR = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
            configurable: true,
            value: () => stubRect,
        });

        await TestBed.configureTestingModule({
            imports: [ChartBrushComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(ChartBrushComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('width', 400);
        fixture.componentRef.setInput('height', 100);
        fixture.detectChanges();
    });

    afterEach(() => {
        if (originalGBCR) {
            Object.defineProperty(Element.prototype, 'getBoundingClientRect', originalGBCR);
        } else {
            delete (Element.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
        }
    });

    function rects(): SVGRectElement[] {
        return Array.from(fixture.nativeElement.querySelectorAll('svg rect')) as SVGRectElement[];
    }

    function mouse(target: EventTarget, type: string, clientX: number): void {
        target.dispatchEvent(new MouseEvent(type, { clientX, clientY: 10, bubbles: true, cancelable: true }));
    }

    function touch(target: EventTarget, type: string, clientX: number): Event {
        const evt = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(evt, 'touches', { value: [{ clientX, clientY: 10 }] });
        Object.defineProperty(evt, 'changedTouches', { value: [{ clientX, clientY: 10 }] });
        target.dispatchEvent(evt);
        return evt;
    }

    it('creates a selection from a mouse drag driven entirely through the DOM', () => {
        let emitted: BrushSelection | null | undefined;
        component.selectionChange.subscribe(s => (emitted = s));

        mouse(rects()[0], 'mousedown', 20);
        expect(component.current()).toEqual({ start: 20, end: 20 });

        mouse(window, 'mousemove', 80);
        mouse(window, 'mouseup', 80);

        expect(emitted).toEqual({ start: 20, end: 80 });
    });

    it('pans the selection when the move rect is dragged via the DOM', () => {
        fixture.componentRef.setInput('selection', { start: 100, end: 200 });
        fixture.detectChanges();
        let emitted: BrushSelection | null | undefined;
        component.selectionChange.subscribe(s => (emitted = s));

        mouse(rects()[1], 'mousedown', 150);
        mouse(window, 'mousemove', 170);
        mouse(window, 'mouseup', 170);

        expect(emitted).toEqual({ start: 120, end: 220 });
    });

    it('resizes the end edge when the end handle is dragged via the DOM', () => {
        fixture.componentRef.setInput('selection', { start: 100, end: 200 });
        fixture.detectChanges();
        let emitted: BrushSelection | null | undefined;
        component.selectionChange.subscribe(s => (emitted = s));

        mouse(rects()[3], 'mousedown', 200);
        mouse(window, 'mousemove', 250);
        mouse(window, 'mouseup', 250);

        expect(emitted).toEqual({ start: 100, end: 250 });
    });

    it('resizes the start edge when the start handle is dragged via the DOM', () => {
        fixture.componentRef.setInput('selection', { start: 100, end: 200 });
        fixture.detectChanges();
        let emitted: BrushSelection | null | undefined;
        component.selectionChange.subscribe(s => (emitted = s));

        mouse(rects()[2], 'mousedown', 100);
        mouse(window, 'mousemove', 60);
        mouse(window, 'mouseup', 60);

        expect(emitted).toEqual({ start: 60, end: 200 });
    });

    it('drives a create drag through touch events (preventDefault on window touchmove)', () => {
        let emitted: BrushSelection | null | undefined;
        component.selectionChange.subscribe(s => (emitted = s));

        touch(rects()[0], 'touchstart', 30);
        expect(component.current()).toEqual({ start: 30, end: 30 });

        touch(window, 'touchmove', 90);
        touch(window, 'touchend', 90);

        expect(emitted).toEqual({ start: 30, end: 90 });
    });

    it('ignores window move/up while idle (no selection created)', () => {
        let emitted: BrushSelection | null | undefined;
        let calls = 0;
        component.selectionChange.subscribe(s => {
            emitted = s;
            calls++;
        });

        mouse(window, 'mousemove', 100);
        mouse(window, 'mouseup', 100);

        expect(calls).toBe(0);
        expect(emitted).toBeUndefined();
        expect(component.current()).toBeNull();
    });

});

describe('ChartBrushComponent guard clauses', () => {
    let component: ChartBrushComponent;
    let fixture: ComponentFixture<ChartBrushComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ChartBrushComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(ChartBrushComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('beginMove is a no-op when there is no selection', () => {
        component.beginMove(50);
        component.pointerMoveTo(90);
        expect(component.current()).toBeNull();
    });

    it('beginResize is a no-op when there is no selection', () => {
        component.beginResize('start', 50);
        component.pointerMoveTo(90);
        expect(component.current()).toBeNull();
    });

    it('pointerMoveTo does nothing while idle', () => {
        let calls = 0;
        component.selectionChange.subscribe(() => calls++);
        component.pointerMoveTo(120);
        expect(calls).toBe(0);
        expect(component.current()).toBeNull();
    });

    it('end does nothing while idle', () => {
        let calls = 0;
        component.selectionChange.subscribe(() => calls++);
        component.end();
        expect(calls).toBe(0);
    });
});
