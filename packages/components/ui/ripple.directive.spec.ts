import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
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

describe('UiRippleDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let button: HTMLButtonElement;

    beforeEach(async () => {
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
    });

    it('should apply position relative to the host element', () => {
        expect(button.style.position).toBe('relative');
    });

    it('should apply overflow hidden to the host element', () => {
        expect(button.style.overflow).toBe('hidden');
    });

    it('should create a ripple span element inside the button on click', () => {
        const mockAnimation = { onfinish: null as (() => void) | null };
        vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(mockAnimation as unknown as Animation);

        button.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 25, bubbles: true }));
        fixture.detectChanges();

        const ripple = button.querySelector('span');
        expect(ripple).toBeTruthy();
        expect(ripple!.style.position).toBe('absolute');
        expect(ripple!.style.borderRadius).toBe('50%');
    });

    it('should size the ripple based on the largest host dimension', () => {
        const mockAnimation = { onfinish: null as (() => void) | null };
        vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(mockAnimation as unknown as Animation);

        button.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 25, bubbles: true }));
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

        button.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 25, bubbles: true }));
        fixture.detectChanges();

        expect(button.querySelector('span')).toBeTruthy();

        if (finishCallback) finishCallback();

        expect(button.querySelector('span')).toBeFalsy();
    });

    it('should not create a ripple when disabled input is true', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');
        button.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 25, bubbles: true }));
        fixture.detectChanges();

        expect(button.querySelector('span')).toBeFalsy();
        expect(animateSpy).not.toHaveBeenCalled();
    });

    it('should apply custom ripple color', () => {
        host.color.set('rgba(0, 0, 255, 0.5)');
        fixture.detectChanges();

        const mockAnimation = { onfinish: null as (() => void) | null };
        vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(mockAnimation as unknown as Animation);

        button.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 25, bubbles: true }));
        fixture.detectChanges();

        const ripple = button.querySelector<HTMLSpanElement>('span')!;
        expect(ripple.style.backgroundColor).toBe('rgba(0, 0, 255, 0.5)');
    });

    it('should pass custom duration to the animate call', () => {
        host.duration.set(300);
        fixture.detectChanges();

        const mockAnimation = { onfinish: null as (() => void) | null };
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(mockAnimation as unknown as Animation);

        button.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 25, bubbles: true }));
        fixture.detectChanges();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({ duration: 300 })
        );
    });
});
