import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ParticlesComponent } from './particles.component';

interface TestParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
}

interface ParticlesInternals {
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
    particles: TestParticle[];
    animate: () => void;
    syncCanvasSize: () => void;
    createParticles: () => void;
}

function internals(comp: ParticlesComponent): ParticlesInternals {
    return comp as unknown as ParticlesInternals;
}

interface DrawCall {
    op: string;
    args: number[];
}

/** Every drawing call made on the fake context, in order; tests clear it per frame. */
const drawLog: DrawCall[] = [];
/** The context the component obtained, so its style fields can be read back. */
let lastContext: CanvasRenderingContext2D | null = null;

function arcs(): { x: number; y: number }[] {
    return drawLog.filter(c => c.op === 'arc').map(c => ({ x: c.args[0], y: c.args[1] }));
}

function countOps(op: string): number {
    return drawLog.filter(c => c.op === op).length;
}

// Fake 2D context: jsdom has no canvas 2D context, so the drawing methods only
// record themselves and the style/alpha fields are plain writable properties.
function makeContext(): CanvasRenderingContext2D {
    const noop = (): void => {};
    const record = (op: string) => (...args: number[]): void => {
        drawLog.push({ op, args });
    };
    lastContext = {
        clearRect: noop,
        fillRect: noop,
        beginPath: noop,
        arc: record('arc'),
        fill: noop,
        moveTo: noop,
        lineTo: record('lineTo'),
        stroke: record('stroke'),
        closePath: noop,
        save: noop,
        restore: noop,
        translate: noop,
        scale: noop,
        createLinearGradient: () => ({ addColorStop: noop }),
        fillStyle: '',
        strokeStyle: '',
        globalAlpha: 1,
        lineWidth: 0.5,
    } as unknown as CanvasRenderingContext2D;
    return lastContext;
}

/**
 * Makes `Math.random` return `values` in order (then 0.5). Each particle draws
 * five values: x / width, y / height, vx and vy as `(r - 0.5) * speed`, radius.
 */
function seedRandom(values: number[]): void {
    const queue = [...values];
    vi.spyOn(Math, 'random').mockImplementation(() => queue.shift() ?? 0.5);
}

type CanvasProto = { getContext: (id: string) => unknown };
type MatchMediaWindow = { matchMedia?: (q: string) => MediaQueryList };

// Module-scoped stub state, reset in every beforeEach.
let reduceMotion = false;
let stubWidth = 200;
let stubHeight = 200;
let latestResizeCallback: ResizeObserverCallback | null = null;
let savedMatchMedia: PropertyDescriptor | undefined;

let savedGetContext: CanvasProto['getContext'];
let savedResizeObserver: typeof globalThis.ResizeObserver | undefined;
let savedWidthDesc: PropertyDescriptor | undefined;
let savedHeightDesc: PropertyDescriptor | undefined;
let savedGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;

function makeMediaQueryList(query: string): MediaQueryList {
    return {
        matches: reduceMotion,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    } as MediaQueryList;
}

function installDom(): void {
    const canvasProto = HTMLCanvasElement.prototype as unknown as CanvasProto;
    savedGetContext = canvasProto.getContext;
    canvasProto.getContext = (id: string) => (id === '2d' ? makeContext() : null);

    savedResizeObserver = globalThis.ResizeObserver;
    latestResizeCallback = null;
    globalThis.ResizeObserver = class {
        constructor(cb: ResizeObserverCallback) {
            latestResizeCallback = cb;
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    } as unknown as typeof globalThis.ResizeObserver;

    savedMatchMedia = Object.getOwnPropertyDescriptor(globalThis.window, 'matchMedia');
    (globalThis.window as unknown as MatchMediaWindow).matchMedia = makeMediaQueryList;

    savedWidthDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
    savedHeightDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
    Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => stubWidth });
    Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get: () => stubHeight });

    savedGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (): DOMRect {
        return {
            left: 0, top: 0, right: stubWidth, bottom: stubHeight,
            width: stubWidth, height: stubHeight, x: 0, y: 0, toJSON: () => ({}),
        } as DOMRect;
    };
}

function restoreDom(): void {
    (HTMLCanvasElement.prototype as unknown as CanvasProto).getContext = savedGetContext;
    if (savedResizeObserver) {
        globalThis.ResizeObserver = savedResizeObserver;
    } else {
        delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    }
    if (savedMatchMedia) {
        Object.defineProperty(globalThis.window, 'matchMedia', savedMatchMedia);
    } else {
        delete (globalThis.window as unknown as MatchMediaWindow).matchMedia;
    }
    restoreDescriptor('clientWidth', savedWidthDesc);
    restoreDescriptor('clientHeight', savedHeightDesc);
    Element.prototype.getBoundingClientRect = savedGetBoundingClientRect;
}

function restoreDescriptor(prop: string, desc: PropertyDescriptor | undefined): void {
    if (desc) {
        Object.defineProperty(Element.prototype, prop, desc);
    } else {
        delete (Element.prototype as unknown as Record<string, unknown>)[prop];
    }
}

@Component({
    template: `
        <ui-particles
            [count]="count()"
            [color]="color()"
            [speed]="speed()"
            [connectDistance]="connectDistance()"
            [mouseInteraction]="mouseInteraction()"
            [style.color]="hostColor()"
            style="width:200px;height:200px;display:block"
        />
    `,
    imports: [ParticlesComponent],
})
class HostComponent {
    count = signal(20);
    color = signal('hsl(var(--foreground))');
    speed = signal(0.5);
    connectDistance = signal(120);
    mouseInteraction = signal(true);
    hostColor = signal('');
}

function queryHostEl(fixture: ComponentFixture<HostComponent>): HTMLElement {
    return fixture.debugElement.query(By.directive(ParticlesComponent)).nativeElement as HTMLElement;
}

function queryComp(fixture: ComponentFixture<HostComponent>): ParticlesComponent {
    return fixture.debugElement.query(By.directive(ParticlesComponent)).componentInstance as ParticlesComponent;
}

describe('ParticlesComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let rafCallbacks: FrameRequestCallback[];

    beforeEach(async () => {
        reduceMotion = false;
        stubWidth = 200;
        stubHeight = 200;
        rafCallbacks = [];
        let rafId = 0;
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            rafCallbacks.push(cb);
            rafId += 1;
            return rafId;
        });
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
        installDom();
        drawLog.length = 0;
        lastContext = null;

        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
    });

    /** Runs every pending animation frame, recording only that frame's drawing. */
    function runFrame(): void {
        drawLog.length = 0;
        for (const cb of rafCallbacks.splice(0)) cb(0);
    }

    afterEach(() => {
        restoreDom();
        vi.restoreAllMocks();
    });

    it('creates a canvas child, positions it and sets pointer-events none', () => {
        fixture.detectChanges();
        const canvas = queryHostEl(fixture).querySelector<HTMLCanvasElement>('canvas');
        expect(canvas).toBeTruthy();
        expect(canvas!.parentElement).toBe(queryHostEl(fixture));
        expect(canvas!.style.position).toBe('absolute');
        expect(canvas!.style.pointerEvents).toBe('none');
    });

    it('sets the data-slot and absolute position on the host', () => {
        fixture.detectChanges();
        const hostEl = queryHostEl(fixture);
        expect(hostEl.dataset['slot']).toBe('particles');
        expect(hostEl.style.position).toBe('absolute');
    });

    it('spawns the requested number of particles sized to the host', () => {
        fixture.detectChanges();
        const canvas = queryHostEl(fixture).querySelector('canvas')!;
        expect(canvas.width).toBe(200);
        expect(canvas.height).toBe(200);
        expect(arcs()).toHaveLength(20);
        runFrame();
        expect(arcs()).toHaveLength(20);
    });

    it('enables pointer events on the host when mouse interaction is on', () => {
        fixture.detectChanges();
        expect(queryHostEl(fixture).style.pointerEvents).toBe('auto');
    });

    it('resolves currentColor from the computed host color when present', () => {
        fixture.componentInstance.color.set('currentColor');
        fixture.componentInstance.hostColor.set('rgb(10, 20, 30)');
        fixture.detectChanges();
        expect(lastContext!.fillStyle).toBe('rgb(10, 20, 30)');
    });

    it('uses a literal color verbatim without touching computed styles', () => {
        const computedSpy = vi.spyOn(globalThis, 'getComputedStyle');
        fixture.componentInstance.color.set('#ff0000');
        fixture.detectChanges();
        expect(lastContext!.fillStyle).toBe('#ff0000');
        expect(computedSpy).not.toHaveBeenCalled();
    });

    it('bounces particles off all four edges and repels them from the pointer', () => {
        fixture.componentInstance.count.set(5);
        fixture.componentInstance.speed.set(2);
        seedRandom([
            0, 0.5, 0, 0.5, 0.5, // (0, 100) heading left
            0.9999, 0.5, 0.99, 0.5, 0.5, // (199.98, 100) heading right
            0.5, 0, 0.5, 0, 0.5, // (100, 0) heading up
            0.5, 0.9999, 0.5, 0.99, 0.5, // (100, 199.98) heading down
            0.52, 0.5, 0.5, 0.5, 0.5, // (104, 100) at rest, beside the pointer
        ]);
        fixture.detectChanges();
        queryHostEl(fixture).dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));

        // Each edge particle crossed its edge in the first frame; a bounce sends it straight back.
        runFrame();
        const [left, right, top, bottom, resting] = arcs();
        expect(left.x).toBeCloseTo(0, 6);
        expect(right.x).toBeCloseTo(199.98, 6);
        expect(top.y).toBeCloseTo(0, 6);
        expect(bottom.y).toBeCloseTo(199.98, 6);
        expect(resting.x).toBeCloseTo(104, 6);

        runFrame();
        expect(arcs()[4].x).toBeGreaterThan(104);
        expect(arcs()[4].y).toBeCloseTo(100, 6);
    });

    it('reschedules a frame without drawing when the canvas has zero size', () => {
        fixture.detectChanges();
        const comp = queryComp(fixture);
        const state = internals(comp);
        internals(comp).canvas!.width = 0;
        const before = rafCallbacks.length;
        state.animate();
        expect(rafCallbacks).toHaveLength(before + 1);
    });

    it('does nothing in a frame once the context is gone', () => {
        fixture.detectChanges();
        const comp = queryComp(fixture);
        const state = internals(comp);
        state.ctx = null;
        const before = rafCallbacks.length;
        state.animate();
        expect(rafCallbacks).toHaveLength(before);
    });

    it('leaves canvas size unchanged when the host has zero dimensions', () => {
        fixture.detectChanges();
        const comp = queryComp(fixture);
        stubWidth = 0;
        stubHeight = 0;
        internals(comp).canvas!.width = 123;
        internals(comp).syncCanvasSize();
        expect(internals(comp).canvas!.width).toBe(123);
    });

    it('does not spawn particles while the canvas measures zero', () => {
        fixture.detectChanges();
        const comp = queryComp(fixture);
        const state = internals(comp);
        internals(comp).canvas!.width = 0;
        state.particles = [];
        state.createParticles();
        expect(state.particles).toHaveLength(0);
    });

    it('respawns particles from the resize observer when the field is empty', () => {
        fixture.detectChanges();
        const comp = queryComp(fixture);
        internals(comp).particles = [];
        latestResizeCallback!([], {} as ResizeObserver);
        expect(internals(comp).particles.length).toBeGreaterThan(0);
    });

    it('tracks the pointer via mousemove and stops repelling on mouseleave', () => {
        fixture.componentInstance.count.set(1);
        seedRandom([0.52, 0.5, 0.5, 0.5, 0.5]); // (104, 100) at rest
        fixture.detectChanges();
        const hostEl = queryHostEl(fixture);

        hostEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
        runFrame();
        runFrame();
        const pushed = arcs()[0].x;
        expect(pushed).toBeGreaterThan(104);

        hostEl.dispatchEvent(new MouseEvent('mouseleave'));
        runFrame();
        const step = arcs()[0].x - pushed;
        runFrame();
        expect(arcs()[0].x - pushed).toBeCloseTo(2 * step, 10);
    });

    it('joins two particles closer than connectDistance with one line', () => {
        fixture.componentInstance.count.set(2);
        seedRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.55, 0.5, 0.5, 0.5, 0.5]); // (100, 100) and (110, 100)
        fixture.detectChanges();
        expect(countOps('lineTo')).toBe(1);
        expect(countOps('stroke')).toBe(1);
    });

    it('cleans up the canvas and animation frame on destroy', () => {
        fixture.detectChanges();
        const hostEl = queryHostEl(fixture);
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        expect(hostEl.querySelector('canvas')).toBeTruthy();
        fixture.destroy();
        expect(hostEl.querySelector('canvas')).toBeFalsy();
        expect(cancelSpy).toHaveBeenCalled();
    });
});

describe('ParticlesComponent without mouse interaction or connections', () => {
    let fixture: ComponentFixture<HostComponent>;

    beforeEach(async () => {
        reduceMotion = false;
        stubWidth = 200;
        stubHeight = 200;
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1 as unknown as number);
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
        installDom();
        drawLog.length = 0;

        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.mouseInteraction.set(false);
        fixture.componentInstance.color.set('#00ff00');
        fixture.componentInstance.connectDistance.set(0);
        fixture.detectChanges();
    });

    afterEach(() => {
        restoreDom();
        vi.restoreAllMocks();
    });

    it('does not enable pointer events on the host', () => {
        const hostEl = queryHostEl(fixture);
        expect(hostEl.style.pointerEvents).not.toBe('auto');
    });

    it('draws the particles but no connecting lines when connectDistance is 0', () => {
        expect(countOps('arc')).toBe(20);
        expect(countOps('lineTo')).toBe(0);
        expect(countOps('stroke')).toBe(0);
    });
});

describe('ParticlesComponent reduced motion behavior', () => {
    let fixture: ComponentFixture<HostComponent>;

    beforeEach(async () => {
        reduceMotion = true;
        stubWidth = 200;
        stubHeight = 200;
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1 as unknown as number);
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
        installDom();

        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        vi.mocked(requestAnimationFrame).mockClear();
        fixture.detectChanges();
    });

    afterEach(() => {
        restoreDom();
        vi.restoreAllMocks();
    });

    it('does not create a canvas or particles', () => {
        const hostEl = queryHostEl(fixture);
        expect(hostEl.querySelector('canvas')).toBeFalsy();
        expect(internals(queryComp(fixture)).particles).toHaveLength(0);
        expect(requestAnimationFrame).not.toHaveBeenCalled();
    });

    it('destroys cleanly without a scheduled frame', () => {
        expect(() => fixture.destroy()).not.toThrow();
    });
});
