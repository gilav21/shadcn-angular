import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UiMagneticDirective } from './magnetic.directive';

@Component({
    template: `
        <div
            uiMagnetic
            [uiMagneticStrength]="strength()"
            [uiMagneticRadius]="radius()"
            [uiMagneticSmoothing]="smoothing()"
            style="width:100px;height:50px;position:fixed;left:0;top:0"
        >Magnetic</div>
    `,
    imports: [UiMagneticDirective],
})
class TestHostComponent {
    strength = signal(0.3);
    radius = signal(200);
    smoothing = signal(150);
}

describe('UiMagneticDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let magnetEl: HTMLElement;

    const rectStub = () =>
        ({ left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50, x: 0, y: 0, toJSON() {} }) as DOMRect;

    let originalRect: PropertyDescriptor | undefined;
    let originalMatchMedia: typeof globalThis.matchMedia | undefined;
    let reducedMotion: boolean;

    const getDirective = (): UiMagneticDirective =>
        fixture.debugElement.query(By.directive(UiMagneticDirective)).injector.get(UiMagneticDirective);

    beforeEach(async () => {
        reducedMotion = false;
        originalRect = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
            configurable: true,
            value: rectStub,
        });

        originalMatchMedia = globalThis.window.matchMedia;
        Object.defineProperty(globalThis.window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: vi.fn(() => ({ matches: reducedMotion }) as unknown as MediaQueryList),
        });

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();

        magnetEl = (fixture.nativeElement as HTMLElement).querySelector('[uiMagnetic]') as HTMLElement;
    });

    afterEach(() => {
        if (originalRect) {
            Object.defineProperty(Element.prototype, 'getBoundingClientRect', originalRect);
        }
        Object.defineProperty(globalThis.window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: originalMatchMedia,
        });
    });

    it('should start with translate(0px, 0px) transform', () => {
        expect(getDirective().transform()).toBe('translate(0px, 0px)');
    });

    it('should apply initial zero transform via host binding', () => {
        expect(magnetEl.style.transform).toBe('translate(0px, 0px)');
    });

    it('should apply translate transform when cursor moves within radius', () => {
        const directive = getDirective();

        magnetEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 25, bubbles: true }));

        expect(directive.transform()).not.toBe('translate(0px, 0px)');
        expect(directive.transform()).toContain('translate(');
    });

    it('should calculate pull based on strength input', () => {
        host.strength.set(0.5);
        fixture.detectChanges();

        const directive = getDirective();
        magnetEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 25, bubbles: true }));

        const transform = directive.transform();
        const match = /translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/.exec(transform);
        expect(match).toBeTruthy();

        const pullX = Number.parseFloat(match![1]);
        const centerX = 50;
        const distX = 60 - centerX;
        expect(Math.abs(pullX - distX * 0.5)).toBeLessThan(0.01);
    });

    it('should reset transform to zero on mouseleave', () => {
        const directive = getDirective();

        magnetEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 25, bubbles: true }));
        expect(directive.transform()).not.toBe('translate(0px, 0px)');

        magnetEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        expect(directive.transform()).toBe('translate(0px, 0px)');
    });

    it('should not move when cursor is beyond the radius', () => {
        host.radius.set(10);
        fixture.detectChanges();

        const directive = getDirective();

        magnetEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 500, bubbles: true }));
        expect(directive.transform()).toBe('translate(0px, 0px)');
    });

    it('should not move when reduced motion is preferred', () => {
        reducedMotion = true;
        const directive = getDirective();

        magnetEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 25, bubbles: true }));
        expect(directive.transform()).toBe('translate(0px, 0px)');
    });

    it('should apply smoothing transition via host binding', () => {
        host.smoothing.set(300);
        fixture.detectChanges();

        expect(magnetEl.style.transition).toContain('300ms');
    });

    it('should stop reacting to mousemove after destroy', () => {
        const directive = getDirective();
        fixture.destroy();

        magnetEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 25, bubbles: true }));
        expect(directive.transform()).toBe('translate(0px, 0px)');
    });
});
