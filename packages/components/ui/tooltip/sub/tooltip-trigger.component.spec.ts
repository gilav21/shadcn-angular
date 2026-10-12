import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TooltipComponent } from '../tooltip.component';
import { TooltipTriggerComponent } from './tooltip-trigger.component';

/** RED until spec 8 Task 4: an expected failure under vitest, skipped where `it.fails` does not exist (the jest consumer leg). */
const redUntilTask4 = Reflect.has(it, 'fails') ? it.fails : it.skip;

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
            @if (showTrigger()) {
                <ui-tooltip-trigger>Hover me</ui-tooltip-trigger>
            }
        </ui-tooltip>
    `,
    imports: [TooltipComponent, TooltipTriggerComponent],
})
class TriggerHost {
    delay = signal(200);
    showTrigger = signal(true);
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

    /** A finger landing on the trigger, as a browser dispatches it: bubbling, through the document. */
    function fireTouchStart(): TouchEvent {
        const event = new Event('touchstart', { bubbles: true, cancelable: true }) as TouchEvent;
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

    describe('mouse (hover) interactions', () => {
        it('shows after the default 200ms delay', () => {
            fire('mouseenter');
            vi.advanceTimersByTime(199);
            expect(tooltip().open()).toBe(false);
            vi.advanceTimersByTime(1);
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

        redUntilTask4('keeps a tapped-open tooltip through the emulated mouseleave', () => {
            fireTouchStart();
            fire('mouseleave');
            expect(tooltip().open()).toBe(true);
        });

        redUntilTask4('shows on touchstart and leaves the tap to the wrapped control', () => {
            const event = fireTouchStart();
            expect(tooltip().open()).toBe(true);
            expect(event.defaultPrevented).toBe(false);
        });

        redUntilTask4('toggles off on a second touchstart', () => {
            fireTouchStart();
            expect(tooltip().open()).toBe(true);
            fireTouchStart();
            expect(tooltip().open()).toBe(false);
        });

        redUntilTask4('auto-dismisses after the touch timeout', () => {
            fireTouchStart();
            expect(tooltip().open()).toBe(true);
            vi.advanceTimersByTime(2500);
            expect(tooltip().open()).toBe(false);
        });

        redUntilTask4('dismisses when a touchstart is dispatched elsewhere on the document', () => {
            fireTouchStart();
            expect(tooltip().open()).toBe(true);
            document.body.dispatchEvent(new Event('touchstart', { bubbles: true }));
            expect(tooltip().open()).toBe(false);
        });
    });

    function removeTrigger(): void {
        host.showTrigger.set(false);
        fixture.detectChanges();
    }

    it('clears timers and the document listener on destroy', () => {
        restoreTouch?.();
        restoreTouch = setTouchDevice(true);
        fireTouchStart();
        removeTrigger();
        tooltip().show();
        // A leaked listener or auto-dismiss timer would close the still-live tooltip.
        document.body.dispatchEvent(new Event('touchstart', { bubbles: true }));
        vi.advanceTimersByTime(2500);
        expect(tooltip().open()).toBe(true);
    });

    it('clears a pending hover delay timeout on destroy', () => {
        fire('mouseenter');
        vi.advanceTimersByTime(100);
        removeTrigger();
        vi.advanceTimersByTime(500);
        expect(tooltip().open()).toBe(false);
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

/** The shape every tooltip story uses: a real control inside the trigger. */
@Component({
    template: `
        <ui-tooltip>
            <ui-tooltip-trigger><button type="button" (click)="saved = saved + 1">Save</button></ui-tooltip-trigger>
        </ui-tooltip>
    `,
    imports: [TooltipComponent, TooltipTriggerComponent],
})
class WrappedControlHost {
    saved = 0;
}

describe('TooltipTriggerComponent — a control wrapped in the trigger, on touch', () => {
    let restoreTouch: (() => void) | null = null;

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreTouch?.();
    });

    // UC-7, UC-8. A browser turns an un-prevented touch into the control's click;
    // the trigger must show the tooltip without cancelling it, and the tooltip it
    // shows must outlive the tap that opened it.
    redUntilTask4('shows on tap, keeps the tooltip, and leaves the control its tap', async () => {
        vi.useFakeTimers();
        restoreTouch = setTouchDevice(true);
        await TestBed.configureTestingModule({ imports: [WrappedControlHost] }).compileComponents();
        const fixture = TestBed.createComponent(WrappedControlHost);
        fixture.detectChanges();
        const tooltip: TooltipComponent = fixture.debugElement.query(By.directive(TooltipComponent)).componentInstance;
        const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

        const touchstart = new Event('touchstart', { bubbles: true, cancelable: true }) as TouchEvent;
        button.dispatchEvent(touchstart);
        button.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        if (!touchstart.defaultPrevented) button.click();

        expect(touchstart.defaultPrevented).toBe(false);
        expect(fixture.componentInstance.saved).toBe(1);
        expect(tooltip.open()).toBe(true);
    });
});
