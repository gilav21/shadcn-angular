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

    it('shows the tooltip after the 200ms delay', () => {
        fire('mouseenter');
        vi.advanceTimersByTime(199);
        expect(tooltipNode()).toBeNull();
        vi.advanceTimersByTime(1);
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
        expect(document.body.querySelectorAll(TOOLTIP_SELECTOR)).toHaveLength(1);
    });

    function stubHostRect(rect: Partial<DOMRect>): void {
        buttonEl().getBoundingClientRect = () =>
            ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, ...rect }) as DOMRect;
    }

    /** The shown bubble's box, read from the styles the directive wrote and its own size. */
    function bubbleBox(): { top: number; left: number; width: number; height: number } {
        const node = tooltipNode()!;
        const { width, height } = node.getBoundingClientRect();
        return { top: Number.parseFloat(node.style.top), left: Number.parseFloat(node.style.left), width, height };
    }

    describe('side placement', () => {
        for (const side of ['top', 'bottom', 'left', 'right'] as const) {
            it(`places the bubble on side="${side}" with an 8px gap`, () => {
                const cx = globalThis.innerWidth / 2;
                const cy = globalThis.innerHeight / 2;
                const hostRect = { top: cy - 10, bottom: cy + 10, left: cx - 30, right: cx + 30, width: 60, height: 20 };
                stubHostRect(hostRect);
                host.side.set(side);
                fixture.detectChanges();
                fire('mouseenter');
                vi.advanceTimersByTime(200);
                const b = bubbleBox();
                const gap = {
                    top: hostRect.top - (b.top + b.height),
                    bottom: b.top - hostRect.bottom,
                    left: hostRect.left - (b.left + b.width),
                    right: b.left - hostRect.right,
                }[side];
                expect(gap).toBeCloseTo(8, 1);
            });
        }
    });

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
            const top = globalThis.innerHeight - 14;
            stubHostRect({ top, bottom: top + 10, left: 200, right: 260, width: 60, height: 10 });
            host.side.set('bottom');
            fixture.detectChanges();
            fire('mouseenter');
            vi.advanceTimersByTime(200);
            // The clamp alone would leave the bubble overlapping the host.
            const b = bubbleBox();
            expect(b.top + b.height).toBeLessThanOrEqual(top - 8 + 0.5);
        });

        it('flips left → right when the tooltip would overflow the left edge', () => {
            stubHostRect({ top: 200, bottom: 220, left: 0, right: 10, width: 10, height: 20 });
            host.side.set('left');
            fixture.detectChanges();
            fire('mouseenter');
            vi.advanceTimersByTime(200);
            // Without the flip the clamp pins it to left 8, over the host.
            expect(bubbleBox().left).toBeGreaterThanOrEqual(10);
        });

        it('flips right → left when the tooltip would overflow the right edge', () => {
            const left = globalThis.innerWidth - 10;
            stubHostRect({ top: 200, bottom: 220, left, right: left + 10, width: 10, height: 20 });
            host.side.set('right');
            fixture.detectChanges();
            fire('mouseenter');
            vi.advanceTimersByTime(200);
            const b = bubbleBox();
            expect(b.left + b.width).toBeLessThanOrEqual(left + 0.5);
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

@Component({
    template: `
        <span [uiTooltip]="'Contents host'" style="display: contents">
            <button>Real target</button>
        </span>
    `,
    imports: [TooltipDirective],
})
class ContentsHost {}

@Component({
    template: `<span [uiTooltip]="'Empty contents'" style="display: contents"></span>`,
    imports: [TooltipDirective],
})
class EmptyContentsHost {}

describe('TooltipDirective — display:contents host', () => {
    let restoreTouch: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
        restoreTouch = setTouchDevice(false);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreTouch?.();
        document.body.querySelectorAll(TOOLTIP_SELECTOR).forEach((el) => el.remove());
    });

    it('resolves the first child element as the positioning target', async () => {
        await TestBed.configureTestingModule({ imports: [ContentsHost] }).compileComponents();
        const fixture = TestBed.createComponent(ContentsHost);
        fixture.detectChanges();

        const hostSpan = fixture.debugElement.query(By.directive(TooltipDirective)).nativeElement as HTMLElement;
        const target = { top: 300, bottom: 330, left: 150, right: 250, width: 100, height: 30 };
        Object.defineProperty(hostSpan.querySelector('button')!, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({ ...target, x: target.left, y: target.top, toJSON: () => ({}) }),
        });
        hostSpan.dispatchEvent(new Event('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(200);

        // Default side="top", centred on the inner button (the span itself has a zero rect).
        const node = tooltipNode()!;
        const { width, height } = node.getBoundingClientRect();
        expect(Number.parseFloat(node.style.top)).toBeCloseTo(target.top - height - 8, 1);
        expect(Number.parseFloat(node.style.left)).toBeCloseTo(target.left + (target.width - width) / 2, 1);
    });

    it('falls back to the host when a contents element has no children', async () => {
        await TestBed.configureTestingModule({ imports: [EmptyContentsHost] }).compileComponents();
        const fixture = TestBed.createComponent(EmptyContentsHost);
        fixture.detectChanges();

        const hostSpan = fixture.debugElement.query(By.directive(TooltipDirective)).nativeElement as HTMLElement;
        hostSpan.dispatchEvent(new Event('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(200);
        expect(tooltipNode()).toBeTruthy();
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

    it('keeps a tapped-open tooltip through the emulated mouseleave', () => {
        fireTouchStart();
        buttonEl().dispatchEvent(new Event('mouseleave', { bubbles: true }));
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
});
