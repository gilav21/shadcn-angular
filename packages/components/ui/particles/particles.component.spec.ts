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
    animationFrameId: number | null;
    mouseX: number;
    mouseY: number;
    resolvedColor: string;
    animate: () => void;
    syncCanvasSize: () => void;
    createParticles: () => void;
}

function internals(comp: ParticlesComponent): ParticlesInternals {
    return comp as unknown as ParticlesInternals;
}

// Fake 2D context: jsdom has no canvas 2D context, so every method is a no-op
// and the style/alpha fields are plain writable properties the component sets.
function makeContext(): CanvasRenderingContext2D {
    const noop = (): void => {};
    return {
        clearRect: noop,
        fillRect: noop,
        beginPath: noop,
        arc: noop,
        fill: noop,
        moveTo: noop,
        lineTo: noop,
        stroke: noop,
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
}

type CanvasProto = { getContext: (id: string) => unknown };
type MatchMediaWindow = { matchMedia?: (q: string) => MediaQueryList };

// Module-scoped stub state, reset in every beforeEach.
let reduceMotion = false;
let stubWidth = 200;
let stubHeight = 200;
let latestResizeCallback: ResizeObserverCallback | null = null;

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
    delete (globalThis.window as unknown as MatchMediaWindow).matchMedia;
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

        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
    });

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
        const comp = queryComp(fixture);
        expect(internals(comp).particles).toHaveLength(20);
        expect(internals(comp).canvas!.width).toBe(200);
    });

    it('exposes count, color and mouseInteraction inputs', () => {
        fixture.detectChanges();
        const comp = queryComp(fixture);
        expect(comp.count()).toBe(20);
        expect(comp.color()).toBe('hsl(var(--foreground))');
        expect(comp.mouseInteraction()).toBe(true);
    });

    it('enables pointer events on the host when mouse interaction is on', () => {
        fixture.detectChanges();
        expect(queryHostEl(fixture).style.pointerEvents).toBe('auto');
    });

    it('resolves currentColor from the computed host color when present', () => {
        fixture.componentInstance.color.set('currentColor');
        fixture.componentInstance.hostColor.set('rgb(10, 20, 30)');
        fixture.detectChanges();
        expect(internals(queryComp(fixture)).resolvedColor).toBe('rgb(10, 20, 30)');
    });

    it('uses a literal color verbatim without touching computed styles', () => {
        fixture.componentInstance.color.set('#ff0000');
        fixture.detectChanges();
        expect(internals(queryComp(fixture)).resolvedColor).toBe('#ff0000');
    });

    it('re-runs a frame that moves particles, wraps edges and reacts to the mouse', () => {
        fixture.detectChanges();
        const comp = queryComp(fixture);
        const state = internals(comp);
        state.particles = [
            { x: -5, y: 100, vx: 1, vy: 1, radius: 2 },
            { x: 205, y: 100, vx: 1, vy: 1, radius: 2 },
            { x: 100, y: -5, vx: 1, vy: 1, radius: 2 },
            { x: 100, y: 205, vx: 1, vy: 1, radius: 2 },
            { x: 100, y: 100, vx: 1, vy: 1, radius: 2 },
            { x: 104, y: 100, vx: 1, vy: 1, radius: 2 },
        ];
        state.mouseX = 100;
        state.mouseY = 100;
        state.animate();
        expect(state.particles[0].vx).toBe(-1);
        expect(state.particles[2].vy).toBe(-1);
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

    it('skips sizing when the canvas is absent', () => {
        fixture.detectChanges();
        const comp = queryComp(fixture);
        const state = internals(comp);
        state.canvas = null;
        expect(() => state.syncCanvasSize()).not.toThrow();
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

    it('tracks the pointer via mousemove and resets it on mouseleave', () => {
        fixture.detectChanges();
        const comp = queryComp(fixture);
        const hostEl = queryHostEl(fixture);
        hostEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 160 }));
        expect(internals(comp).mouseX).toBe(150);
        expect(internals(comp).mouseY).toBe(160);
        hostEl.dispatchEvent(new MouseEvent('mouseleave'));
        expect(internals(comp).mouseX).toBe(-1000);
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

    it('still spawns particles and runs a frame without connections', () => {
        const comp = queryComp(fixture);
        expect(internals(comp).particles).toHaveLength(20);
        expect(() => internals(comp).animate()).not.toThrow();
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
    });

    it('still sets the data-slot attribute', () => {
        expect(queryHostEl(fixture).dataset['slot']).toBe('particles');
    });

    it('never schedules an animation frame', () => {
        expect(internals(queryComp(fixture)).animationFrameId).toBeNull();
    });

    it('destroys cleanly without a scheduled frame', () => {
        expect(() => fixture.destroy()).not.toThrow();
    });
});
