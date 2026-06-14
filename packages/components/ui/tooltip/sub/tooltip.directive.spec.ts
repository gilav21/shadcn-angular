import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TooltipDirective } from './tooltip.directive';

const TOOLTIP_SELECTOR = 'div.fixed.z-50';

function tooltipNode(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>(TOOLTIP_SELECTOR);
}

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
        <button
            [uiTooltip]="text()"
            [tooltipSide]="side()"
            [tooltipDisabled]="disabled()"
        >
            Hover me
        </button>
    `,
    imports: [TooltipDirective],
})
class DirectiveHost {
    text = signal('Tooltip text');
    side = signal<'top' | 'bottom' | 'left' | 'right'>('top');
    disabled = signal(false);
}

describe('TooltipDirective', () => {
    let fixture: ComponentFixture<DirectiveHost>;
    let host: DirectiveHost;
    let restoreTouch: (() => void) | null = null;

    function buttonEl(): HTMLElement {
        return fixture.debugElement.query(By.directive(TooltipDirective)).nativeElement;
    }

    function fire(type: string): void {
        buttonEl().dispatchEvent(new Event(type, { bubbles: true }));
    }

    beforeEach(async () => {
        vi.useFakeTimers();
        restoreTouch = setTouchDevice(false);
        await TestBed.configureTestingModule({ imports: [DirectiveHost] }).compileComponents();
        fixture = TestBed.createComponent(DirectiveHost);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreTouch?.();
        document.body.querySelectorAll(TOOLTIP_SELECTOR).forEach((el) => el.remove());
    });

    it('creates the directive on the host element', () => {
        expect(fixture.debugElement.query(By.directive(TooltipDirective))).toBeTruthy();
    });

    it('does not show the tooltip immediately on mouseenter (200ms delay)', () => {
        fire('mouseenter');
        expect(tooltipNode()).toBeNull();
    });

    it('shows the tooltip after the 200ms delay', () => {
        fire('mouseenter');
        vi.advanceTimersByTime(200);
        const node = tooltipNode();
        expect(node).toBeTruthy();
        expect(node?.textContent).toBe('Tooltip text');
    });

    it('appends the tooltip to document.body with the expected classes', () => {
        fire('mouseenter');
        vi.advanceTimersByTime(200);
        const node = tooltipNode();
        expect(node?.parentElement).toBe(document.body);
        expect(node?.className).toContain('bg-primary');
        expect(node?.className).toContain('pointer-events-none');
    });

    it('positions the tooltip with inline top/left styles', () => {
        fire('mouseenter');
        vi.advanceTimersByTime(200);
        const node = tooltipNode()!;
        expect(node.style.top).toMatch(/px$/);
        expect(node.style.left).toMatch(/px$/);
    });

    it('hides the tooltip on mouseleave', () => {
        fire('mouseenter');
        vi.advanceTimersByTime(200);
        expect(tooltipNode()).toBeTruthy();
        fire('mouseleave');
        expect(tooltipNode()).toBeNull();
    });

    it('cancels a pending show when mouseleave fires before the delay elapses', () => {
        fire('mouseenter');
        vi.advanceTimersByTime(100);
        fire('mouseleave');
        vi.advanceTimersByTime(200);
        expect(tooltipNode()).toBeNull();
    });

    it('does not show when tooltipDisabled is true', () => {
        host.disabled.set(true);
        fixture.detectChanges();
        fire('mouseenter');
        vi.advanceTimersByTime(200);
        expect(tooltipNode()).toBeNull();
    });

    it('does not create a second tooltip when mouseenter fires twice', () => {
        fire('mouseenter');
        vi.advanceTimersByTime(200);
        fire('mouseenter');
        vi.advanceTimersByTime(200);
        expect(document.body.querySelectorAll(TOOLTIP_SELECTOR).length).toBe(1);
    });

    it('renders updated tooltip text', () => {
        host.text.set('Updated');
        fixture.detectChanges();
        fire('mouseenter');
        vi.advanceTimersByTime(200);
        expect(tooltipNode()?.textContent).toBe('Updated');
    });

    describe('side placement', () => {
        for (const side of ['top', 'bottom', 'left', 'right'] as const) {
            it(`positions for side="${side}" without error`, () => {
                host.side.set(side);
                fixture.detectChanges();
                fire('mouseenter');
                vi.advanceTimersByTime(200);
                const node = tooltipNode();
                expect(node).toBeTruthy();
                expect(node?.style.top).toMatch(/px$/);
            });
        }
    });

    function stubHostRect(rect: Partial<DOMRect>): void {
        buttonEl().getBoundingClientRect = () =>
            ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, ...rect }) as DOMRect;
    }

    describe('viewport-edge flipping', () => {
        it('flips top → bottom when the tooltip would overflow the top edge', () => {
            // Host pinned to the very top: side=top puts pos.top negative → flip to bottom.
            stubHostRect({ top: 0, bottom: 10, left: 200, right: 260, width: 60, height: 10 });
            host.side.set('top');
            fixture.detectChanges();
            fire('mouseenter');
            vi.advanceTimersByTime(200);
            const node = tooltipNode()!;
            // bottom placement → tooltip sits below the host (top >= host.bottom).
            expect(Number.parseFloat(node.style.top)).toBeGreaterThanOrEqual(10);
        });

        it('flips bottom → top when the tooltip would overflow the bottom edge', () => {
            stubHostRect({
                top: globalThis.innerHeight,
                bottom: globalThis.innerHeight + 10,
                left: 200,
                right: 260,
                width: 60,
                height: 10,
            });
            host.side.set('bottom');
            fixture.detectChanges();
            fire('mouseenter');
            vi.advanceTimersByTime(200);
            expect(tooltipNode()).toBeTruthy();
        });

        it('flips left → right when the tooltip would overflow the left edge', () => {
            stubHostRect({ top: 200, bottom: 220, left: 0, right: 10, width: 10, height: 20 });
            host.side.set('left');
            fixture.detectChanges();
            fire('mouseenter');
            vi.advanceTimersByTime(200);
            expect(tooltipNode()).toBeTruthy();
        });

        it('flips right → left when the tooltip would overflow the right edge', () => {
            stubHostRect({
                top: 200,
                bottom: 220,
                left: globalThis.innerWidth - 10,
                right: globalThis.innerWidth,
                width: 10,
                height: 20,
            });
            host.side.set('right');
            fixture.detectChanges();
            fire('mouseenter');
            vi.advanceTimersByTime(200);
            expect(tooltipNode()).toBeTruthy();
        });
    });

    it('cleans up the tooltip and timers on destroy', () => {
        fire('mouseenter');
        vi.advanceTimersByTime(200);
        expect(tooltipNode()).toBeTruthy();
        fixture.destroy();
        expect(tooltipNode()).toBeNull();
    });

    it('clears a pending delay timeout on destroy (no tooltip appears later)', () => {
        fire('mouseenter');
        vi.advanceTimersByTime(100);
        fixture.destroy();
        vi.advanceTimersByTime(500);
        expect(tooltipNode()).toBeNull();
    });
});

describe('TooltipDirective — touch device', () => {
    let fixture: ComponentFixture<DirectiveHost>;
    let host: DirectiveHost;
    let restoreTouch: (() => void) | null = null;

    function buttonEl(): HTMLElement {
        return fixture.debugElement.query(By.directive(TooltipDirective)).nativeElement;
    }

    function fireTouchStart(): TouchEvent {
        // Non-bubbling: the directive's own scheduleDismiss adds a document-level
        // touchstart listener; a bubbling event would immediately reach it and cancel
        // the just-shown tooltip. Real touches add that listener mid-dispatch (so the
        // spec skips it for the in-flight event); a non-bubbling synthetic event models
        // the same end state deterministically.
        const event = new Event('touchstart', { bubbles: false, cancelable: true }) as TouchEvent;
        buttonEl().dispatchEvent(event);
        return event;
    }

    beforeEach(async () => {
        vi.useFakeTimers();
        restoreTouch = setTouchDevice(true);
        await TestBed.configureTestingModule({ imports: [DirectiveHost] }).compileComponents();
        fixture = TestBed.createComponent(DirectiveHost);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreTouch?.();
        document.body.querySelectorAll(TOOLTIP_SELECTOR).forEach((el) => el.remove());
    });

    it('mouseenter is a no-op on touch devices', () => {
        buttonEl().dispatchEvent(new Event('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(200);
        expect(tooltipNode()).toBeNull();
    });

    it('mouseleave is a no-op on touch devices (does not throw)', () => {
        expect(() => buttonEl().dispatchEvent(new Event('mouseleave', { bubbles: true }))).not.toThrow();
    });

    it('shows the tooltip immediately on touchstart', () => {
        fireTouchStart();
        expect(tooltipNode()).toBeTruthy();
    });

    it('does not preventDefault on touchstart, so the host click still fires', () => {
        const event = fireTouchStart();
        expect(event.defaultPrevented).toBe(false);
    });

    it('toggles the tooltip off on a second touchstart', () => {
        fireTouchStart();
        expect(tooltipNode()).toBeTruthy();
        fireTouchStart();
        expect(tooltipNode()).toBeNull();
    });

    it('auto-dismisses the tooltip after the touch timeout', () => {
        fireTouchStart();
        expect(tooltipNode()).toBeTruthy();
        vi.advanceTimersByTime(2500);
        expect(tooltipNode()).toBeNull();
    });

    it('dismisses when a touchstart is dispatched elsewhere on the document', () => {
        fireTouchStart();
        expect(tooltipNode()).toBeTruthy();
        document.dispatchEvent(new Event('touchstart', { bubbles: true }));
        expect(tooltipNode()).toBeNull();
    });

    it('touchstart is a no-op when disabled', () => {
        host.disabled.set(true);
        fixture.detectChanges();
        const event = fireTouchStart();
        expect(event.defaultPrevented).toBe(false);
        expect(tooltipNode()).toBeNull();
    });

    it('cleans up the document listener and timers on destroy', () => {
        fireTouchStart();
        expect(tooltipNode()).toBeTruthy();
        fixture.destroy();
        expect(tooltipNode()).toBeNull();
        // A stray document touchstart after destroy must not throw or resurrect anything.
        expect(() => document.dispatchEvent(new Event('touchstart', { bubbles: true }))).not.toThrow();
    });
});
