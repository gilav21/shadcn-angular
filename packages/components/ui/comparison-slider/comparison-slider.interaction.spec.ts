import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComparisonSliderComponent } from './comparison-slider.component';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

interface MockResizeObserverEntry {
    contentRect: { width: number; height: number };
}

class MockResizeObserver {
    static readonly instances: MockResizeObserver[] = [];
    private readonly cb: (entries: MockResizeObserverEntry[]) => void;
    constructor(cb: (entries: MockResizeObserverEntry[]) => void) {
        this.cb = cb;
        MockResizeObserver.instances.push(this);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    trigger(width: number, height: number): void {
        this.cb([{ contentRect: { width, height } }]);
    }
}

const RECT = { top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300, x: 0, y: 0, toJSON() {} };

describe('ComparisonSliderComponent — pointer & resize interactions', () => {
    let component: ComparisonSliderComponent;
    let fixture: ComponentFixture<ComparisonSliderComponent>;
    let root: HTMLElement;
    let savedRectDescriptor: PropertyDescriptor | undefined;
    let savedResizeObserver: PropertyDescriptor | undefined;

    beforeEach(async () => {
        savedRectDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({ ...RECT }),
        });

        savedResizeObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
        MockResizeObserver.instances.length = 0;
        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            writable: true,
            value: MockResizeObserver,
        });

        await TestBed.configureTestingModule({
            imports: [ComparisonSliderComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ComparisonSliderComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('beforeSrc', 'a.png');
        fixture.componentRef.setInput('afterSrc', 'b.png');
        fixture.detectChanges();
        root = fixture.nativeElement.querySelector('[data-slot="comparison-slider"]');
    });

    afterEach(() => {
        fixture.destroy();
        if (savedRectDescriptor) {
            Object.defineProperty(Element.prototype, 'getBoundingClientRect', savedRectDescriptor);
        } else {
            delete (Element.prototype as unknown as Record<string, unknown>)['getBoundingClientRect'];
        }
        if (savedResizeObserver) {
            Object.defineProperty(globalThis, 'ResizeObserver', savedResizeObserver);
        } else {
            delete (globalThis as unknown as Record<string, unknown>)['ResizeObserver'];
        }
    });

    it('updates rootWidth/rootHeight when the ResizeObserver fires', () => {
        expect(MockResizeObserver.instances).toHaveLength(1);
        MockResizeObserver.instances[0].trigger(640, 360);
        expect(component.rootWidth()).toBe(640);
        expect(component.rootHeight()).toBe(360);
    });

    it('sets position from pointer on mousedown (horizontal)', () => {
        root.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 0, bubbles: true }));
        expect(component.position()).toBe(25);
    });

    it('tracks the divider on window mousemove and stops on mouseup', () => {
        root.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, clientY: 0, bubbles: true }));
        expect(component.position()).toBe(50);

        globalThis.window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 0 }));
        expect(component.position()).toBe(75);

        globalThis.window.dispatchEvent(new MouseEvent('mouseup'));
        globalThis.window.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 0 }));
        expect(component.position()).toBe(75);
    });

    it('clamps pointer position beyond the right edge to 100', () => {
        root.dispatchEvent(new MouseEvent('mousedown', { clientX: 999, clientY: 0, bubbles: true }));
        expect(component.position()).toBe(100);
    });

    it('computes vertical position from clientY', () => {
        fixture.componentRef.setInput('orientation', 'vertical');
        fixture.detectChanges();
        root.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 150, bubbles: true }));
        expect(component.position()).toBe(50);
    });

    it('sets position from the first touch on touchstart', () => {
        const event = {
            touches: [{ clientX: 100, clientY: 0 }],
            preventDefault() {},
        } as unknown as TouchEvent;
        component.onTrackTouchStart(event);
        expect(component.position()).toBe(25);
    });

    it('ignores touchstart with no active touches', () => {
        component.position.set(42);
        const event = { touches: [], preventDefault() {} } as unknown as TouchEvent;
        component.onTrackTouchStart(event);
        expect(component.position()).toBe(42);
    });

    it('restarts drag cleanly when a new drag begins mid-drag', () => {
        root.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 0, bubbles: true }));
        expect(component.position()).toBe(25);
        root.dispatchEvent(new MouseEvent('mousedown', { clientX: 300, clientY: 0, bubbles: true }));
        expect(component.position()).toBe(75);
        globalThis.window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 0 }));
        expect(component.position()).toBe(50);
    });
});
