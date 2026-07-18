import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WobbleCardComponent } from './wobble-card.component';

@Component({
    template: `
        <ui-wobble-card [intensity]="intensity()" [perspective]="perspective()" [class]="cls()">
            <p>Card Content</p>
        </ui-wobble-card>
    `,
    imports: [WobbleCardComponent],
})
class TestHostComponent {
    intensity = signal(15);
    perspective = signal(1000);
    cls = signal('');
}

interface TransformStyle {
    transform: string;
}

const RECT = { top: 0, left: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0, toJSON() { /* jsdom stub */ } };

describe('WobbleCardComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let reducedMotion = false;
    const originalRect = Element.prototype.getBoundingClientRect;
    const originalMatchMedia = (globalThis.window as unknown as { matchMedia?: unknown }).matchMedia;

    beforeEach(async () => {
        reducedMotion = false;
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
            configurable: true,
            value: () => RECT,
        });
        Object.defineProperty(globalThis.window, 'matchMedia', {
            configurable: true,
            value: vi.fn((query: string) => ({
                matches: query.includes('reduced-motion') && reducedMotion,
                media: query,
            })),
        });

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
            configurable: true,
            value: originalRect,
        });
        if (originalMatchMedia === undefined) {
            delete (globalThis.window as unknown as { matchMedia?: unknown }).matchMedia;
        } else {
            Object.defineProperty(globalThis.window, 'matchMedia', {
                configurable: true,
                value: originalMatchMedia,
            });
        }
    });

    function comp(): WobbleCardComponent {
        return fixture.debugElement.query(By.directive(WobbleCardComponent)).componentInstance as WobbleCardComponent;
    }

    function nativeEl(): HTMLElement {
        return fixture.debugElement.query(By.directive(WobbleCardComponent)).nativeElement as HTMLElement;
    }

    it('should render projected content', () => {
        expect(nativeEl().textContent?.trim()).toBe('Card Content');
    });

    it('should have initial transform with zero rotation', () => {
        const style = nativeEl().style.transform;
        expect(style).toContain('rotateX(0deg)');
        expect(style).toContain('rotateY(0deg)');
    });

    it('should include perspective in the initial transform', () => {
        host.perspective.set(800);
        fixture.detectChanges();
        expect((comp().styles() as TransformStyle).transform).toContain('perspective(800px)');
    });

    it('should apply rotation on mousemove based on cursor position', () => {
        nativeEl().dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 30, bubbles: true }));
        fixture.detectChanges();

        // center is (100,100). x=150 -> rotateY = ((150-100)/100)*15 = 7.5
        // y=30 -> rotateX = ((30-100)/100)*-15 = 10.5
        const transform = (comp().styles() as TransformStyle).transform;
        expect(transform).toContain('rotateY(7.5deg)');
        expect(transform).toContain('rotateX(10.5deg)');
    });

    it('should scale rotation with the intensity input', () => {
        host.intensity.set(30);
        fixture.detectChanges();

        nativeEl().dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 100, bubbles: true }));
        fixture.detectChanges();

        // x=150 -> rotateY = ((150-100)/100)*30 = 15
        expect((comp().styles() as TransformStyle).transform).toContain('rotateY(15deg)');
    });

    it('should not apply rotation when reduced motion is preferred', () => {
        reducedMotion = true;

        nativeEl().dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 30, bubbles: true }));
        fixture.detectChanges();

        const transform = (comp().styles() as TransformStyle).transform;
        expect(transform).toContain('rotateX(0deg)');
        expect(transform).toContain('rotateY(0deg)');
    });

    it('should reset rotation on mouseleave', () => {
        nativeEl().dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 30, bubbles: true }));
        fixture.detectChanges();
        expect((comp().styles() as TransformStyle).transform).not.toContain('rotateX(0deg)');

        nativeEl().dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        fixture.detectChanges();

        const transform = (comp().styles() as TransformStyle).transform;
        expect(transform).toContain('rotateX(0deg)');
        expect(transform).toContain('rotateY(0deg)');
    });

    it('should apply data-slot attribute', () => {
        expect(nativeEl().dataset['slot']).toBe('wobble-card');
    });

    it('should apply custom class', () => {
        host.cls.set('my-card');
        fixture.detectChanges();
        expect(nativeEl().className).toContain('my-card');
    });

    it('should apply base classes including rounded-xl', () => {
        expect(nativeEl().className).toContain('rounded-xl');
    });
});
