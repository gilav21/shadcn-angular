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

interface DirectiveInternals {
    _particles: unknown[];
    _animationFrameId: number | null;
    _ctx: CanvasRenderingContext2D | null;
    _canvas: HTMLCanvasElement | null;
}

function getDirective<T>(fixture: ComponentFixture<T>): UiConfettiDirective {
    const directiveEl = fixture.debugElement.query(
        By.directive(UiConfettiDirective),
    );
    return directiveEl.injector.get(UiConfettiDirective);
}

function internals(directive: UiConfettiDirective): DirectiveInternals {
    return directive as unknown as DirectiveInternals;
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

@Component({
    template: `<div uiConfetti [options]="opts">Content</div>`,
    imports: [UiConfettiDirective],
})
class CustomParticleCountHostComponent {
    opts: ConfettiOptions = { particleCount: 10 };
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

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should set position relative on host element', () => {
        const hostEl = fixture.nativeElement.querySelector(
            '[uiConfetti]',
        ) as HTMLElement;
        expect(hostEl.style.position).toBe('relative');
    });

    it('should set overflow hidden on host element', () => {
        const hostEl = fixture.nativeElement.querySelector(
            '[uiConfetti]',
        ) as HTMLElement;
        expect(hostEl.style.overflow).toBe('hidden');
    });

    it('should create a canvas element inside the host', () => {
        const hostEl = fixture.nativeElement.querySelector(
            '[uiConfetti]',
        ) as HTMLElement;
        expect(hostEl.querySelector('canvas')).toBeTruthy();
    });

    it('should style canvas as absolute positioned with no pointer events', () => {
        const hostEl = fixture.nativeElement.querySelector(
            '[uiConfetti]',
        ) as HTMLElement;
        const canvas = hostEl.querySelector('canvas') as HTMLCanvasElement;
        expect(canvas.style.position).toBe('absolute');
        expect(canvas.style.pointerEvents).toBe('none');
    });

    it('should set default z-index of 100 on canvas', () => {
        const hostEl = fixture.nativeElement.querySelector(
            '[uiConfetti]',
        ) as HTMLElement;
        const canvas = hostEl.querySelector('canvas') as HTMLCanvasElement;
        expect(canvas.style.zIndex).toBe('100');
    });

    it('should create exactly 50 particles and draw them with default options', () => {
        const directive = getDirective(fixture);

        directive.fire();

        expect(internals(directive)._particles).toHaveLength(50);
        // The animation loop ran one frame drawing every particle: with the
        // default ['square','circle'] shapes both draw branches are exercised.
        expect(fakeCtx.clearRect).toHaveBeenCalled();
        expect(fakeCtx.fillRect).toHaveBeenCalled();
        expect(fakeCtx.ellipse).toHaveBeenCalled();
    });

    it('should start animation and schedule the next frame when particles survive', () => {
        const directive = getDirective(fixture);

        directive.fire();

        expect(internals(directive)._animationFrameId).not.toBeNull();
        expect(globalThis.requestAnimationFrame).toHaveBeenCalled();
    });

    it('should not launch a second concurrent animation loop while already running', () => {
        const directive = getDirective(fixture);

        directive.fire();
        const firstFrameId = internals(directive)._animationFrameId;
        const rafCountAfterFirst = rafCallbacks.length;

        // Second fire while animating: adds particles but does NOT kick off a
        // fresh _animate() call (animationFrameId is not null).
        directive.fire();

        expect(internals(directive)._animationFrameId).toBe(firstFrameId);
        expect(rafCallbacks).toHaveLength(rafCountAfterFirst);
        expect(internals(directive)._particles).toHaveLength(100);
    });

    it('should remove particles and stop the loop once they expire', () => {
        const directive = getDirective(fixture);

        // ticks:1 => opacity hits 0 on the first frame, so every particle is
        // culled and the loop terminates (animationFrameId back to null).
        vi.spyOn(directive, 'options').mockReturnValue({ ticks: 1 });

        directive.fire();

        expect(internals(directive)._particles).toHaveLength(0);
        expect(internals(directive)._animationFrameId).toBeNull();
        // Final clearRect after the last particle is removed.
        expect(fakeCtx.clearRect).toHaveBeenCalled();
    });

    it('should advance across multiple frames when driven manually', () => {
        const directive = getDirective(fixture);
        vi.spyOn(directive, 'options').mockReturnValue({
            particleCount: 5,
            ticks: 3,
        });

        directive.fire();
        expect(internals(directive)._particles.length).toBeGreaterThan(0);

        // Drive queued frames until the loop stops requesting more.
        let guard = 0;
        while (rafCallbacks.length > 0 && guard < 20) {
            const cb = rafCallbacks.shift();
            cb?.(performance.now());
            guard++;
        }

        expect(internals(directive)._particles).toHaveLength(0);
        expect(internals(directive)._animationFrameId).toBeNull();
    });

    it('should not fire when the 2D context is unavailable', () => {
        const directive = getDirective(fixture);
        internals(directive)._ctx = null;

        directive.fire();

        expect(internals(directive)._particles).toHaveLength(0);
        expect(fakeCtx.clearRect).not.toHaveBeenCalled();
    });

    it('should skip firing when reduced motion is preferred', () => {
        matchMediaMatches = true;
        const directive = getDirective(fixture);

        directive.fire();

        expect(internals(directive)._particles).toHaveLength(0);
    });

    it('should still fire under reduced motion when disableForReducedMotion is false', () => {
        matchMediaMatches = true;
        const directive = getDirective(fixture);
        vi.spyOn(directive, 'options').mockReturnValue({
            disableForReducedMotion: false,
            particleCount: 7,
        });

        directive.fire();

        expect(internals(directive)._particles).toHaveLength(7);
    });

    it('should launch two cannons for the side-cannons variant', () => {
        const directive = getDirective(fixture);
        vi.spyOn(directive, 'options').mockReturnValue({
            variant: 'side-cannons',
        });

        directive.fire();

        // Two launches of the default 50 particles each.
        expect(internals(directive)._particles).toHaveLength(100);
    });

    it('should resize the canvas from ResizeObserver entries', () => {
        const directive = getDirective(fixture);
        const canvas = internals(directive)._canvas as HTMLCanvasElement;

        expect(resizeCallback).toBeTruthy();
        resizeCallback?.([{ contentRect: { width: 640, height: 480 } }]);

        expect(canvas.width).toBe(640);
        expect(canvas.height).toBe(480);
    });

    it('should ignore ResizeObserver entries when the canvas is gone', () => {
        const directive = getDirective(fixture);
        internals(directive)._canvas = null;

        expect(() =>
            resizeCallback?.([{ contentRect: { width: 100, height: 100 } }]),
        ).not.toThrow();
    });

    it('should cancel the animation frame and clear particles on destroy', () => {
        const directive = getDirective(fixture);

        directive.fire();
        expect(internals(directive)._animationFrameId).not.toBeNull();
        expect(internals(directive)._particles.length).toBeGreaterThan(0);

        fixture.destroy();

        expect(cancelSpy).toHaveBeenCalled();
        expect(internals(directive)._animationFrameId).toBeNull();
        expect(internals(directive)._particles).toHaveLength(0);
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

describe('UiConfettiDirective with custom particle count', () => {
    let fixture: ComponentFixture<CustomParticleCountHostComponent>;

    beforeEach(async () => {
        installStubs();

        await TestBed.configureTestingModule({
            imports: [CustomParticleCountHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(CustomParticleCountHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        restoreStubs();
    });

    it('should create the specified number of particles from options', () => {
        const directive = getDirective(fixture);

        directive.fire();

        expect(internals(directive)._particles).toHaveLength(10);
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
        const directive = getDirective(fixture);

        expect(internals(directive)._particles).toHaveLength(0);

        fixture.componentInstance.trigger.set(true);
        fixture.detectChanges();

        expect(internals(directive)._particles).toHaveLength(20);
    });

    it('should not fire on initial render when manualTrigger is false', () => {
        const directive = getDirective(fixture);

        expect(internals(directive)._particles).toHaveLength(0);
    });
});
