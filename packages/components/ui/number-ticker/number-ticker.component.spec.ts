import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NumberTickerComponent, NumberTickerDigitComponent } from './number-ticker.component';

type RafCb = (timestamp: number) => void;

interface FakeAnimation {
    onfinish: (() => void) | null;
    finish: () => void;
    cancel: () => void;
}

let rafQueue: RafCb[] = [];
let rafIdSeq = 0;
let cancelledIds: number[] = [];
let reducedMotion = false;
let animations: FakeAnimation[] = [];
let originalAnimate: unknown;

function installStubs(): void {
    rafQueue = [];
    rafIdSeq = 0;
    cancelledIds = [];
    reducedMotion = false;
    animations = [];

    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: reducedMotion,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    }));

    vi.stubGlobal('requestAnimationFrame', (cb: RafCb): number => {
        rafQueue.push(cb);
        return ++rafIdSeq;
    });

    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
        cancelledIds.push(id);
    });

    const proto = Element.prototype as unknown as { animate?: unknown };
    originalAnimate = proto.animate;
    proto.animate = function (): FakeAnimation {
        const anim: FakeAnimation = {
            onfinish: null,
            finish: () => undefined,
            cancel: () => undefined,
        };
        animations.push(anim);
        return anim;
    };
}

function restoreStubs(): void {
    vi.unstubAllGlobals();
    const proto = Element.prototype as unknown as { animate?: unknown };
    if (originalAnimate === undefined) {
        delete proto.animate;
    } else {
        proto.animate = originalAnimate;
    }
}

function flushFrame(timestamp: number): void {
    const cbs = rafQueue;
    rafQueue = [];
    for (const cb of cbs) cb(timestamp);
}

/**
 * The zoneless change-detection scheduler also enqueues frames through the
 * stubbed `requestAnimationFrame` (via `scheduleCallbackWithRafRace`), so the
 * raw queue mixes CD frames with the ticker's own loop. Filtering by the
 * component's `_animate` reference isolates the animation frames the length
 * assertions actually care about.
 */
function animationFrames(cmp: NumberTickerComponent): RafCb[] {
    const animate = (cmp as unknown as { _animate: RafCb })._animate;
    return rafQueue.filter((cb) => cb === animate);
}

/**
 * Waits for the component to have started `count` animations, driving the
 * stubbed frame queue as it goes. `vi.waitFor` alone cannot get there: zoneless
 * change detection schedules through the same stubbed `requestAnimationFrame`,
 * so the effect that starts an animation only runs once a frame is flushed, and
 * nothing else flushes one.
 */
async function waitForAnimations(
    fixture: ComponentFixture<unknown>,
    count: number,
): Promise<void> {
    // The only caller is the digit suite, which runs on real timers: the
    // zoneless scheduler races the stubbed `requestAnimationFrame` against a
    // timeout, so the effect that starts an animation lands on the timer leg
    // and flushing frames alone never gets there. Pump a frame and yield a
    // macrotask until the animations appear.
    //
    // The wait is a deadline rather than a fixed iteration budget, and it does
    // not touch the timer mocks. A budget is a bet on how many turns the
    // scheduler needs, which a loaded run loses; and `vi.advanceTimersByTime`
    // throws outright here ("timers APIs are not mocked") — it only ever went
    // unnoticed because the loop body is skipped whenever the animation has
    // already started.
    const deadline = Date.now() + 5000;
    let frame = 0;
    while (animations.length < count && Date.now() < deadline) {
        frame += 16;
        flushFrame(frame);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        fixture.detectChanges();
    }
    expect(animations).toHaveLength(count);
}

describe('NumberTickerComponent — animation (deterministic frames)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        installStubs();
    });

    // Teardown mirrors setup in reverse. `installStubs` runs while fake timers
    // are installed, so `vi.stubGlobal` records the *fake* `requestAnimationFrame`
    // as the original; unstubbing after `useRealTimers` therefore reinstalls that
    // fake rAF over the native one, and it queues into a clock that no longer
    // exists. Every later file on this worker then inherits an rAF that never
    // fires — a spec awaiting a real frame hangs until its timeout.
    afterEach(() => {
        vi.clearAllTimers();
        restoreStubs();
        vi.useRealTimers();
    });

    async function makeTicker(inputs: Record<string, unknown>): Promise<ComponentFixture<NumberTickerComponent>> {
        await TestBed.configureTestingModule({ imports: [NumberTickerComponent] }).compileComponents();
        const fixture = TestBed.createComponent(NumberTickerComponent);
        for (const [key, val] of Object.entries(inputs)) {
            fixture.componentRef.setInput(key, val);
        }
        fixture.detectChanges();
        return fixture;
    }

    it('counts up to the target across eased frames', async () => {
        const fixture = await makeTicker({ value: 100, duration: 1 });
        const cmp = fixture.componentInstance;

        vi.advanceTimersByTime(1);
        flushFrame(0);
        expect(cmp.displayValue()).toBe('0');

        flushFrame(500);
        const mid = Number(cmp.displayValue());
        expect(mid).toBeGreaterThan(0);
        expect(mid).toBeLessThan(100);

        flushFrame(1000);
        expect(cmp.displayValue()).toBe('100');
    });

    it('renders one digit component per formatted character', async () => {
        const fixture = await makeTicker({ value: 1234, duration: 1 });
        const cmp = fixture.componentInstance;

        vi.advanceTimersByTime(1);
        flushFrame(0);
        flushFrame(1000);
        fixture.detectChanges();

        expect(cmp.displayValue()).toBe('1,234');
        const digits = fixture.debugElement.queryAll(By.directive(NumberTickerDigitComponent));
        expect(digits).toHaveLength(5);
        const span = fixture.debugElement.query(By.css('.tabular-nums'));
        expect(span).toBeTruthy();
    });

    it('waits for the configured delay before scheduling frames', async () => {
        const fixture = await makeTicker({ value: 50, duration: 1, delay: 2 });
        const cmp = fixture.componentInstance;

        vi.advanceTimersByTime(1999);
        expect(animationFrames(cmp)).toHaveLength(0);

        vi.advanceTimersByTime(1);
        expect(animationFrames(cmp)).toHaveLength(1);

        flushFrame(0);
        flushFrame(1000);
        expect(cmp.displayValue()).toBe('50');
    });

    it('formats with the configured decimal places', async () => {
        const fixture = await makeTicker({ value: 12.5, duration: 1, decimalPlaces: 2 });
        const cmp = fixture.componentInstance;

        vi.advanceTimersByTime(1);
        flushFrame(0);
        flushFrame(1000);
        expect(cmp.displayValue()).toBe('12.50');
    });

    it('animates downward when a lower target replaces the current value', async () => {
        const fixture = await makeTicker({ value: 100, duration: 1, direction: 'down' });
        const cmp = fixture.componentInstance;

        vi.advanceTimersByTime(1);
        flushFrame(0);
        flushFrame(1000);
        expect(cmp.displayValue()).toBe('100');

        const cancelledBefore = cancelledIds.length;
        fixture.componentRef.setInput('value', 20);
        fixture.detectChanges();
        expect(cancelledIds.length).toBeGreaterThan(cancelledBefore);

        vi.advanceTimersByTime(1);
        flushFrame(0);
        flushFrame(500);
        const midDown = Number(cmp.displayValue());
        expect(midDown).toBeGreaterThan(20);
        expect(midDown).toBeLessThan(100);

        flushFrame(1000);
        expect(cmp.displayValue()).toBe('20');
    });

    it('jumps straight to the target when reduced motion is preferred', async () => {
        reducedMotion = true;
        const fixture = await makeTicker({ value: 1234, duration: 1 });
        const cmp = fixture.componentInstance;

        expect(cmp.displayValue()).toBe('1,234');
        expect(animationFrames(cmp)).toHaveLength(0);
    });

    it('cancels the pending frame on destroy', async () => {
        const fixture = await makeTicker({ value: 100, duration: 1 });

        vi.advanceTimersByTime(1);
        flushFrame(0);

        const before = cancelledIds.length;
        fixture.destroy();
        expect(cancelledIds.length).toBeGreaterThan(before);
    });

    it('merges a custom class into the computed classes', async () => {
        const fixture = await makeTicker({ value: 1, duration: 1, class: 'text-red-500' });
        const cmp = fixture.componentInstance;

        expect(cmp.classes()).toContain('text-red-500');
        expect(cmp.classes()).toContain('tabular-nums');
    });
});

describe('NumberTickerDigitComponent', () => {
    @Component({
        template: `<ui-number-ticker-digit [digit]="digit()" />`,
        imports: [NumberTickerDigitComponent],
    })
    class DigitHostComponent {
        digit = signal('5');
    }

    let fixture: ComponentFixture<DigitHostComponent>;
    let host: DigitHostComponent;

    beforeEach(async () => {
        installStubs();
        await TestBed.configureTestingModule({
            imports: [DigitHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(DigitHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        // The component animates only on a digit change AFTER its effect has run
        // once (the first pass takes the `!_initialized` branch and just seeds
        // prevDigit). If a test changes the digit before that first pass lands —
        // which is what happens when `detectChanges()` is slow under a loaded
        // coverage run — the effect initialises straight to the NEW digit and no
        // animation is ever created, so the tests below fail deterministically
        // rather than flakily. Wait for the seed before touching the input.
        await vi.waitFor(() => expect(digitInstance().prevDigit()).toBe('5'));
        // Seeding prevDigit is not enough: the effect's first pass does it
        // without touching the DOM, so it can land before the view has
        // rendered. The animation the tests below wait for is only created when
        // the component finds its `.flex` container — with the view still
        // unrendered the digit change takes the silent fallback branch, sets
        // prevDigit directly and creates no animation at all. Wait for the
        // container the component actually looks for.
        await vi.waitFor(() => {
            fixture.detectChanges();
            expect(fixture.nativeElement.querySelector('.flex')).not.toBeNull();
        });
    });

    afterEach(() => {
        restoreStubs();
    });

    function digitInstance(): NumberTickerDigitComponent {
        return fixture.debugElement.query(By.directive(NumberTickerDigitComponent)).componentInstance as NumberTickerDigitComponent;
    }

    it('renders the digit value', () => {
        const element = fixture.debugElement.query(By.directive(NumberTickerDigitComponent));
        expect(element.nativeElement.textContent).toContain('5');
    });

    it('flags numeric characters as digits and others as not', () => {
        const el = digitInstance();
        expect(el.isDigit()).toBe(true);

        host.digit.set(',');
        fixture.detectChanges();
        expect(el.isDigit()).toBe(false);
        expect(el.prevDigit()).toBe(',');
        expect(animations).toHaveLength(0);
    });

    // The animation is created inside a signal effect. Asserting immediately
    // after `detectChanges()` assumes the effect has already flushed, which only
    // holds while the machine is idle — under a loaded full-suite run the flush
    // can land a tick later and the assertion sees zero animations. Waiting for
    // the condition keeps the assertion identical but load-independent.
    it('animates a digit change and settles prevDigit when the animation finishes', async () => {
        const el = digitInstance();

        host.digit.set('7');
        fixture.detectChanges();

        await waitForAnimations(fixture, 1);
        expect(el.prevDigit()).toBe('5');

        animations[0].onfinish?.();
        expect(el.prevDigit()).toBe('7');
    });

    it('finishes an in-flight animation before starting the next', async () => {
        host.digit.set('7');
        fixture.detectChanges();
        await waitForAnimations(fixture, 1);

        const finishSpy = vi.spyOn(animations[0], 'finish');

        host.digit.set('3');
        fixture.detectChanges();

        await waitForAnimations(fixture, 2);
        expect(finishSpy).toHaveBeenCalled();
    });

    it('falls back to setting prevDigit when the flex container is missing', () => {
        const debugEl = fixture.debugElement.query(By.directive(NumberTickerDigitComponent));
        const el = debugEl.componentInstance as NumberTickerDigitComponent;
        vi.spyOn(debugEl.nativeElement, 'querySelector').mockReturnValue(null);

        host.digit.set('8');
        fixture.detectChanges();

        expect(el.prevDigit()).toBe('8');
        expect(animations).toHaveLength(0);
    });
});

describe('NumberTickerComponent — i18n integration', () => {
    beforeEach(() => {
        installStubs();
    });

    afterEach(() => {
        restoreStubs();
    });

    async function setup(opts: { locale?: string; providerLocale?: string } = {}): Promise<ComponentFixture<NumberTickerComponent>> {
        reducedMotion = true;
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [NumberTickerComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(NumberTickerComponent);
        fixture.componentRef.setInput('value', 1234);
        fixture.componentRef.setInput('duration', 0);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults the resolved locale to the app-wide value when no locale is set', async () => {
        const fixture = await setup();
        expect(fixture.componentInstance.resolvedLocale()).toBe('en');
    });

    it('resolves locale from the per-instance input', async () => {
        const fixture = await setup({ locale: 'de' });
        expect(fixture.componentInstance.resolvedLocale()).toBe('de');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'fr' });
        expect(fixture.componentInstance.resolvedLocale()).toBe('fr');
    });
});
