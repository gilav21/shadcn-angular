import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UiRippleDirective } from './ripple.directive';

@Component({
    template: `<button uiRipple [uiRippleDisabled]="disabled()" [uiRippleColor]="color()" [uiRippleDuration]="duration()">Click</button>`,
    imports: [UiRippleDirective],
})
class TestHostComponent {
    disabled = signal(false);
    color = signal('color-mix(in srgb, currentColor 35%, transparent)');
    duration = signal(600);
}

interface MockAnimation {
    onfinish: (() => void) | null;
}

function clickAt(button: HTMLButtonElement, clientX: number, clientY: number): void {
    button.dispatchEvent(new MouseEvent('click', { clientX, clientY, bubbles: true }));
}

describe('UiRippleDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let button: HTMLButtonElement;

    let originalAnimate: PropertyDescriptor | undefined;
    let originalMatchMedia: PropertyDescriptor | undefined;

    beforeEach(async () => {
        // jsdom does not implement the Web Animations API — provide a stub so
        // the directive's `ripple.animate(...)` call (and spies on it) work.
        originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
        Object.defineProperty(HTMLElement.prototype, 'animate', {
            configurable: true,
            writable: true,
            value: (): MockAnimation => ({ onfinish: null }),
        });

        // jsdom does not implement matchMedia — default to "no reduced motion".
        originalMatchMedia = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
        Object.defineProperty(globalThis, 'matchMedia', {
            configurable: true,
            writable: true,
            value: (query: string): MediaQueryList =>
                ({ matches: false, media: query } as unknown as MediaQueryList),
        });

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();

        button = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;

        Object.defineProperty(button, 'getBoundingClientRect', {
            value: () => ({ left: 0, top: 0, width: 100, height: 50 }),
            configurable: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();

        if (originalAnimate) {
            Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
        } else {
            delete (HTMLElement.prototype as { animate?: unknown }).animate;
        }

        if (originalMatchMedia) {
            Object.defineProperty(globalThis, 'matchMedia', originalMatchMedia);
        } else {
            delete (globalThis as { matchMedia?: unknown }).matchMedia;
        }
    });

    it('should apply position relative to the host element', () => {
        expect(button.style.position).toBe('relative');
    });

    it('should apply overflow hidden to the host element', () => {
        expect(button.style.overflow).toBe('hidden');
    });

    it('should clear position and overflow styles when disabled', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        expect(button.style.position).toBe('');
        expect(button.style.overflow).toBe('');
    });

    it('should create a ripple span element inside the button on click', () => {
        const mockAnimation: MockAnimation = { onfinish: null };
        vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(mockAnimation as unknown as Animation);

        clickAt(button, 50, 25);
        fixture.detectChanges();

        const ripple = button.querySelector('span');
        expect(ripple).toBeTruthy();
        expect(ripple!.style.position).toBe('absolute');
        expect(ripple!.style.borderRadius).toBe('50%');
        expect(ripple!.style.pointerEvents).toBe('none');
    });

    it('should position the ripple relative to the click coordinates', () => {
        const mockAnimation: MockAnimation = { onfinish: null };
        vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(mockAnimation as unknown as Animation);

        clickAt(button, 50, 25);
        fixture.detectChanges();

        const ripple = button.querySelector<HTMLSpanElement>('span')!;
        const diameter = Math.max(100, 50) * 2; // 200
        expect(ripple.style.left).toBe(`${50 - diameter / 2}px`); // -50px
        expect(ripple.style.top).toBe(`${25 - diameter / 2}px`); // -75px
    });

    it('should size the ripple based on the largest host dimension', () => {
        const mockAnimation: MockAnimation = { onfinish: null };
        vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(mockAnimation as unknown as Animation);

        clickAt(button, 50, 25);
        fixture.detectChanges();

        const ripple = button.querySelector<HTMLSpanElement>('span')!;
        const expectedDiameter = Math.max(100, 50) * 2;
        expect(ripple.style.width).toBe(`${expectedDiameter}px`);
        expect(ripple.style.height).toBe(`${expectedDiameter}px`);
    });

    it('should remove the ripple span after animation finishes', () => {
        let finishCallback: (() => void) | undefined;
        const mockAnimation = {
            set onfinish(cb: () => void) { finishCallback = cb; },
            get onfinish(): (() => void) | undefined { return finishCallback; },
        };
        vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(mockAnimation as unknown as Animation);

        clickAt(button, 50, 25);
        fixture.detectChanges();

        expect(button.querySelector('span')).toBeTruthy();

        finishCallback?.();

        expect(button.querySelector('span')).toBeFalsy();
    });

    it('should not create a ripple when disabled input is true', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');
        clickAt(button, 50, 25);
        fixture.detectChanges();

        expect(button.querySelector('span')).toBeFalsy();
        expect(animateSpy).not.toHaveBeenCalled();
    });

    it('should not create a ripple when the user prefers reduced motion', () => {
        Object.defineProperty(globalThis, 'matchMedia', {
            configurable: true,
            writable: true,
            value: (query: string): MediaQueryList =>
                ({ matches: true, media: query } as unknown as MediaQueryList),
        });

        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');
        clickAt(button, 50, 25);
        fixture.detectChanges();

        expect(button.querySelector('span')).toBeFalsy();
        expect(animateSpy).not.toHaveBeenCalled();
    });

    it('should apply custom ripple color', () => {
        host.color.set('rgba(0, 0, 255, 0.5)');
        fixture.detectChanges();

        const mockAnimation: MockAnimation = { onfinish: null };
        vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(mockAnimation as unknown as Animation);

        clickAt(button, 50, 25);
        fixture.detectChanges();

        const ripple = button.querySelector<HTMLSpanElement>('span')!;
        expect(ripple.style.backgroundColor).toBe('rgba(0, 0, 255, 0.5)');
    });

    it('should pass custom duration to the animate call', () => {
        host.duration.set(300);
        fixture.detectChanges();

        const mockAnimation: MockAnimation = { onfinish: null };
        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(mockAnimation as unknown as Animation);

        clickAt(button, 50, 25);
        fixture.detectChanges();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({ duration: 300 })
        );
    });

    it('should remove active ripples on destroy', () => {
        const mockAnimation: MockAnimation = { onfinish: null };
        vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(mockAnimation as unknown as Animation);

        clickAt(button, 50, 25);
        fixture.detectChanges();

        const ripple = button.querySelector<HTMLSpanElement>('span')!;
        expect(ripple).toBeTruthy();
        const removeSpy = vi.spyOn(ripple, 'remove');

        fixture.destroy();

        expect(removeSpy).toHaveBeenCalledTimes(1);
    });
});
