import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TooltipComponent } from '../tooltip.component';
import { TooltipTriggerComponent } from './tooltip-trigger.component';

/** Force isTouchDevice() (which reads matchMedia('(pointer: coarse)')) to a value. */
function setTouchDevice(isTouch: boolean): () => void {
    const original = globalThis.window.matchMedia;
    const fake = ((query: string) =>
        ({
            matches: query.includes('coarse') ? isTouch : !isTouch,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList) as typeof globalThis.matchMedia;
    globalThis.window.matchMedia = fake;
    return () => {
        globalThis.window.matchMedia = original;
    };
}

@Component({
    template: `
        <ui-tooltip [delayDuration]="delay()">
            <ui-tooltip-trigger>Hover me</ui-tooltip-trigger>
        </ui-tooltip>
    `,
    imports: [TooltipComponent, TooltipTriggerComponent],
})
class TriggerHost {
    delay = signal(200);
}

/** A trigger with NO ui-tooltip parent — exercises the `tooltip?.` null paths. */
@Component({
    template: `<ui-tooltip-trigger>Orphan</ui-tooltip-trigger>`,
    imports: [TooltipTriggerComponent],
})
class OrphanTriggerHost {}

describe('TooltipTriggerComponent', () => {
    let fixture: ComponentFixture<TriggerHost>;
    let host: TriggerHost;
    let restoreTouch: (() => void) | null = null;

    function tooltip(): TooltipComponent {
        return fixture.debugElement.query(By.directive(TooltipComponent)).componentInstance;
    }

    function spanEl(): HTMLElement {
        return fixture.debugElement.query(By.css('[data-slot="tooltip-trigger"]')).nativeElement;
    }

    function fire(type: string): void {
        spanEl().dispatchEvent(new Event(type, { bubbles: true }));
    }

    /** Non-bubbling so the document-level dismiss listener added mid-dispatch is skipped. */
    function fireTouchStart(): TouchEvent {
        const event = new Event('touchstart', { bubbles: false, cancelable: true }) as TouchEvent;
        spanEl().dispatchEvent(event);
        return event;
    }

    beforeEach(async () => {
        vi.useFakeTimers();
        restoreTouch = setTouchDevice(false);
        await TestBed.configureTestingModule({ imports: [TriggerHost] }).compileComponents();
        fixture = TestBed.createComponent(TriggerHost);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreTouch?.();
    });

    it('creates the trigger', () => {
        expect(fixture.debugElement.query(By.directive(TooltipTriggerComponent))).toBeTruthy();
    });

    describe('mouse (hover) interactions', () => {
        it('does not show immediately on mouseenter (delay pending)', () => {
            fire('mouseenter');
            expect(tooltip().open()).toBe(false);
        });

        it('shows after the default 200ms delay', () => {
            fire('mouseenter');
            vi.advanceTimersByTime(200);
            expect(tooltip().open()).toBe(true);
        });

        it('honours a custom delayDuration', () => {
            host.delay.set(500);
            fixture.detectChanges();
            fire('mouseenter');
            vi.advanceTimersByTime(200);
            expect(tooltip().open()).toBe(false);
            vi.advanceTimersByTime(300);
            expect(tooltip().open()).toBe(true);
        });

        it('hides on mouseleave', () => {
            fire('mouseenter');
            vi.advanceTimersByTime(200);
            expect(tooltip().open()).toBe(true);
            fire('mouseleave');
            expect(tooltip().open()).toBe(false);
        });

        it('cancels a pending show when mouseleave fires before the delay', () => {
            fire('mouseenter');
            vi.advanceTimersByTime(100);
            fire('mouseleave');
            vi.advanceTimersByTime(200);
            expect(tooltip().open()).toBe(false);
        });

        it('ignores touchstart on a non-touch device', () => {
            const event = new Event('touchstart', { bubbles: false, cancelable: true }) as TouchEvent;
            spanEl().dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
            expect(tooltip().open()).toBe(false);
        });
    });

    describe('focus interactions', () => {
        it('shows on focus', () => {
            fire('focus');
            expect(tooltip().open()).toBe(true);
        });

        it('hides on blur', () => {
            fire('focus');
            expect(tooltip().open()).toBe(true);
            fire('blur');
            expect(tooltip().open()).toBe(false);
        });
    });

    describe('touch device', () => {
        beforeEach(() => {
            restoreTouch?.();
            restoreTouch = setTouchDevice(true);
        });

        it('mouseenter is a no-op on touch', () => {
            fire('mouseenter');
            vi.advanceTimersByTime(200);
            expect(tooltip().open()).toBe(false);
        });

        it('mouseleave is a no-op on touch (does not throw)', () => {
            expect(() => fire('mouseleave')).not.toThrow();
        });

        it('shows on touchstart and preventDefaults', () => {
            const event = fireTouchStart();
            expect(tooltip().open()).toBe(true);
            expect(event.defaultPrevented).toBe(true);
        });

        it('toggles off on a second touchstart', () => {
            fireTouchStart();
            expect(tooltip().open()).toBe(true);
            fireTouchStart();
            expect(tooltip().open()).toBe(false);
        });

        it('auto-dismisses after the touch timeout', () => {
            fireTouchStart();
            expect(tooltip().open()).toBe(true);
            vi.advanceTimersByTime(2500);
            expect(tooltip().open()).toBe(false);
        });

        it('dismisses when a touchstart is dispatched elsewhere on the document', () => {
            fireTouchStart();
            expect(tooltip().open()).toBe(true);
            document.dispatchEvent(new Event('touchstart', { bubbles: true }));
            expect(tooltip().open()).toBe(false);
        });
    });

    it('clears timers and the document listener on destroy', () => {
        restoreTouch?.();
        restoreTouch = setTouchDevice(true);
        fireTouchStart();
        expect(tooltip().open()).toBe(true);
        fixture.destroy();
        expect(() => document.dispatchEvent(new Event('touchstart', { bubbles: true }))).not.toThrow();
    });

    it('clears a pending hover delay timeout on destroy', () => {
        fire('mouseenter');
        vi.advanceTimersByTime(100);
        expect(() => fixture.destroy()).not.toThrow();
        vi.advanceTimersByTime(500);
    });
});

describe('TooltipTriggerComponent — no tooltip parent', () => {
    let fixture: ComponentFixture<OrphanTriggerHost>;
    let restoreTouch: (() => void) | null = null;

    function spanEl(): HTMLElement {
        return fixture.debugElement.query(By.css('[data-slot="tooltip-trigger"]')).nativeElement;
    }

    beforeEach(async () => {
        vi.useFakeTimers();
        restoreTouch = setTouchDevice(false);
        await TestBed.configureTestingModule({ imports: [OrphanTriggerHost] }).compileComponents();
        fixture = TestBed.createComponent(OrphanTriggerHost);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreTouch?.();
    });

    it('mouseenter falls back to the 200ms default and does not throw without a tooltip', () => {
        spanEl().dispatchEvent(new Event('mouseenter', { bubbles: true }));
        expect(() => vi.advanceTimersByTime(200)).not.toThrow();
    });

    it('focus and blur are safe no-ops without a tooltip', () => {
        expect(() => {
            spanEl().dispatchEvent(new Event('focus', { bubbles: true }));
            spanEl().dispatchEvent(new Event('blur', { bubbles: true }));
        }).not.toThrow();
    });

    it('touchstart toggle is a safe no-op without a tooltip', () => {
        restoreTouch?.();
        restoreTouch = setTouchDevice(true);
        const event = new Event('touchstart', { bubbles: false, cancelable: true }) as TouchEvent;
        expect(() => spanEl().dispatchEvent(event)).not.toThrow();
    });
});
