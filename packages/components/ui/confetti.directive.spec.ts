import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { UiConfettiDirective, ConfettiOptions } from './confetti.directive';
import {
    describe,
    it,
    expect,
    beforeEach,
    vi,
    afterEach,
    afterAll,
} from 'vitest';

// jsdom provides a <canvas> element but getContext('2d') returns null, and it
// ships neither ResizeObserver nor matchMedia. We stub all three (plus the rAF
// pair) so the directive runs headless. Everything is saved here and restored
// in afterEach/afterAll so no stub leaks into other specs sharing the worker.
const NATIVE_GET_CONTEXT = HTMLCanvasElement.prototype.getContext;
const NATIVE_RESIZE_OBSERVER = globalThis.ResizeObserver;
const NATIVE_MATCH_MEDIA = globalThis.matchMedia;

interface FakeCtx {
    clearRect: ReturnType<typeof vi.fn>;
    beginPath: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    ellipse: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    translate: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    scale: ReturnType<typeof vi.fn>;
    fillStyle: string;
    globalAlpha: number;
}

function createFakeCtx(): FakeCtx {
    return {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        fill: vi.fn(),
        ellipse: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        fillStyle: '',
        globalAlpha: 1,
    };
}

let fakeCtx: FakeCtx;
let rafCallbacks: FrameRequestCallback[];
let cancelSpy: ReturnType<typeof vi.fn>;
let resizeCallback: ((entries: unknown[]) => void) | null;
let matchMediaMatches: boolean;

function installStubs(): void {
    fakeCtx = createFakeCtx();
    rafCallbacks = [];
    resizeCallback = null;
    matchMediaMatches = false;
    cancelSpy = vi.fn();

    HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        contextId: string,
    ) {
        if (contextId === '2d') {
            return fakeCtx as unknown as CanvasRenderingContext2D;
        }
        return NATIVE_GET_CONTEXT.call(this, contextId as '2d');
    } as typeof NATIVE_GET_CONTEXT;

    class FakeResizeObserver {
        constructor(cb: (entries: unknown[]) => void) {
            resizeCallback = cb;
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;

    globalThis.matchMedia = ((_query: string) => ({
        matches: matchMediaMatches,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof matchMedia;

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
        (cb: FrameRequestCallback) => {
            rafCallbacks.push(cb);
            return rafCallbacks.length as unknown as number;
        },
    );
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(
        cancelSpy as unknown as typeof cancelAnimationFrame,
    );
}

function restoreStubs(): void {
    vi.restoreAllMocks();
    globalThis.ResizeObserver = NATIVE_RESIZE_OBSERVER;
    globalThis.matchMedia = NATIVE_MATCH_MEDIA;
}

afterAll(() => {
    HTMLCanvasElement.prototype.getContext = NATIVE_GET_CONTEXT;
    globalThis.ResizeObserver = NATIVE_RESIZE_OBSERVER;
    globalThis.matchMedia = NATIVE_MATCH_MEDIA;
});

function getDirective<T>(fixture: ComponentFixture<T>): UiConfettiDirective {
    const directiveEl = fixture.debugElement.query(
        By.directive(UiConfettiDirective),
    );
    return directiveEl.injector.get(UiConfettiDirective);
}

/** Particles drawn since the last reset: every particle is one fillRect (square) or one ellipse (circle). */
function draws(): number {
    return fakeCtx.fillRect.mock.calls.length + fakeCtx.ellipse.mock.calls.length;
}

function resetDrawCalls(): void {
    fakeCtx.fillRect.mockClear();
    fakeCtx.ellipse.mockClear();
    fakeCtx.clearRect.mockClear();
}

/**
 * Runs one animation frame on fresh draw counters: every callback queued so
 * far, as a browser frame would. Angular's zoneless scheduler queues frames on
 * the same stub, so the queue is never only the directive's.
 */
function runFrame(): void {
    resetDrawCalls();
    const now = performance.now();
    for (const cb of rafCallbacks.splice(0)) cb(now);
}

function createWithOptions(opts: ConfettiOptions): UiConfettiDirective {
    const fixture = TestBed.createComponent(OptionsTestHostComponent);
    fixture.componentInstance.opts = opts;
    fixture.detectChanges();
    return getDirective(fixture);
}

@Component({
    template: `<div uiConfetti>Content</div>`,
    imports: [UiConfettiDirective],
})
class TestHostComponent {}

@Component({
    template: `<div uiConfetti [options]="opts">Content</div>`,
    imports: [UiConfettiDirective],
})
class OptionsTestHostComponent {
    opts: ConfettiOptions = { zIndex: 50 };
}

@Component({
    template: `<div uiConfetti [manualTrigger]="trigger()" [options]="opts">Content</div>`,
    imports: [UiConfettiDirective],
})
class TriggerTestHostComponent {
    readonly trigger = signal(false);
    opts: ConfettiOptions = { particleCount: 20 };
}

describe('UiConfettiDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        installStubs();

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        restoreStubs();
    });

    it('should set position relative on host element', () => {
        const hostEl = fixture.nativeElement.querySelector(
            '[uiConfetti]',
        ) as HTMLElement;
        expect(hostEl.style.position).toBe('relative');
        expect(hostEl.style.overflow).toBe('hidden');
    });

    it('should style canvas as absolute positioned with no pointer events', () => {
        const hostEl = fixture.nativeElement.querySelector(
            '[uiConfetti]',
        ) as HTMLElement;
        const canvas = hostEl.querySelector('canvas') as HTMLCanvasElement;
        expect(canvas.style.position).toBe('absolute');
        expect(canvas.style.pointerEvents).toBe('none');
        expect(canvas.style.zIndex).toBe('100');
    });

    it('should create exactly 50 particles and draw them with default options', () => {
        getDirective(fixture).fire();

        // fire() draws the first frame synchronously; with the default
        // ['square','circle'] shapes both draw branches are exercised.
        expect(draws()).toBe(50);
        expect(fakeCtx.clearRect).toHaveBeenCalled();
        expect(fakeCtx.fillRect).toHaveBeenCalled();
        expect(fakeCtx.ellipse).toHaveBeenCalled();
    });

    it('should not launch a second concurrent animation loop while already running', () => {
        const directive = getDirective(fixture);

        directive.fire();
        const rafCountAfterFirst = rafCallbacks.length;

        directive.fire();

        expect(rafCallbacks).toHaveLength(rafCountAfterFirst);
        // One loop draws all 100 particles once per frame; a second loop would double it.
        runFrame();
        expect(draws()).toBe(100);
    });

    it('should advance across multiple frames when driven manually', () => {
        const directive = createWithOptions({ particleCount: 5, ticks: 3 });

        directive.fire();
        expect(draws()).toBe(5);

        // ticks: 3 → drawn on ticks 1 and 2, faded out on tick 3, which clears
        // the canvas a second time and stops requesting frames.
        runFrame();
        expect(draws()).toBe(5);
        runFrame();
        expect(draws()).toBe(0);
        expect(fakeCtx.clearRect).toHaveBeenCalledTimes(2);
        runFrame();
        expect(fakeCtx.clearRect).not.toHaveBeenCalled();
    });

    it('should not fire when the 2D context is unavailable', () => {
        HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof NATIVE_GET_CONTEXT;
        const noContext = TestBed.createComponent(TestHostComponent);
        noContext.detectChanges();
        const queued = rafCallbacks.length;

        expect(() => getDirective(noContext).fire()).not.toThrow();

        expect(rafCallbacks).toHaveLength(queued);
    });

    it('should skip firing when reduced motion is preferred', () => {
        matchMediaMatches = true;
        const queued = rafCallbacks.length;

        getDirective(fixture).fire();

        expect(rafCallbacks).toHaveLength(queued);
        expect(draws()).toBe(0);
        expect(fakeCtx.clearRect).not.toHaveBeenCalled();
    });

    it('should still fire under reduced motion when disableForReducedMotion is false', () => {
        matchMediaMatches = true;
        const directive = createWithOptions({ disableForReducedMotion: false, particleCount: 7 });

        directive.fire();

        expect(draws()).toBe(7);
    });

    it('should launch two cannons for the side-cannons variant', () => {
        const directive = createWithOptions({ variant: 'side-cannons' });

        directive.fire();

        // Two launches of the default 50 particles each.
        expect(draws()).toBe(100);
    });

    it('should resize the canvas from ResizeObserver entries', () => {
        const canvas = (fixture.nativeElement as HTMLElement).querySelector('[uiConfetti] canvas') as HTMLCanvasElement;

        expect(resizeCallback).toBeTruthy();
        resizeCallback?.([{ contentRect: { width: 640, height: 480 } }]);

        expect(canvas.width).toBe(640);
        expect(canvas.height).toBe(480);
    });

    it('should cancel the animation frame and clear particles on destroy', () => {
        getDirective(fixture).fire();
        const pendingFrameId = rafCallbacks.length;

        fixture.destroy();

        expect(cancelSpy).toHaveBeenCalledWith(pendingFrameId);
        // A frame already queued when destroy ran has nothing left to draw
        // and requests no further frames.
        runFrame();
        expect(draws()).toBe(0);
        runFrame();
        expect(fakeCtx.clearRect).not.toHaveBeenCalled();
    });

    it('should remove canvas from DOM on destroy', () => {
        const hostEl = fixture.nativeElement.querySelector(
            '[uiConfetti]',
        ) as HTMLElement;
        expect(hostEl.querySelector('canvas')).toBeTruthy();

        fixture.destroy();

        expect(hostEl.querySelector('canvas')).toBeFalsy();
    });
});

describe('UiConfettiDirective with custom z-index', () => {
    let fixture: ComponentFixture<OptionsTestHostComponent>;

    beforeEach(async () => {
        installStubs();

        await TestBed.configureTestingModule({
            imports: [OptionsTestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(OptionsTestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        restoreStubs();
    });

    it('should set canvas z-index from options', () => {
        const hostEl = fixture.nativeElement.querySelector(
            '[uiConfetti]',
        ) as HTMLElement;
        const canvas = hostEl.querySelector('canvas') as HTMLCanvasElement;
        expect(canvas.style.zIndex).toBe('50');
    });
});

describe('UiConfettiDirective with manualTrigger', () => {
    let fixture: ComponentFixture<TriggerTestHostComponent>;

    beforeEach(async () => {
        installStubs();

        await TestBed.configureTestingModule({
            imports: [TriggerTestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TriggerTestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        restoreStubs();
    });

    it('should fire confetti when manualTrigger changes to true', () => {
        runFrame();
        expect(draws()).toBe(0);
        expect(fakeCtx.clearRect).not.toHaveBeenCalled();

        fixture.componentInstance.trigger.set(true);
        fixture.detectChanges();

        expect(draws()).toBe(20);
    });
});
