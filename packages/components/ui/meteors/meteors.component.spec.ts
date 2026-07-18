import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MeteorsComponent } from './meteors.component';

type Speed = 'slow' | 'medium' | 'fast';

interface MeteorLike {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    headSize: number;
    trailLength: number;
    opacity: number;
    maxOpacity: number;
    fadeIn: boolean;
}

interface MeteorsInternals {
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
    meteors: MeteorLike[];
    animationFrameId: number | null;
    rgb: { r: number; g: number; b: number };
    animate: () => void;
    spawnMeteor: (randomPhase: boolean) => MeteorLike;
    createMeteors: () => void;
    resolveColor: () => void;
    syncCanvasSize: () => void;
    speedMultiplier: () => number;
    outOfBounds: (m: MeteorLike) => boolean;
    drawMeteor: (ctx: CanvasRenderingContext2D, m: MeteorLike) => void;
}

@Component({
    template: `
        <div style="position:relative;width:400px;height:300px">
            <ui-meteors [count]="count()" [speed]="speed()" [color]="color()" />
        </div>
    `,
    imports: [MeteorsComponent],
})
class TestHostComponent {
    count = signal(10);
    speed = signal<Speed>('medium');
    color = signal('white');
}

function makeMeteor(overrides: Partial<MeteorLike> = {}): MeteorLike {
    return {
        x: 50,
        y: 50,
        vx: 1,
        vy: 1,
        angle: Math.PI * 0.78,
        headSize: 2,
        trailLength: 60,
        opacity: 0.5,
        maxOpacity: 0.5,
        fadeIn: false,
        ...overrides,
    };
}

describe('MeteorsComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let rafSpy: ReturnType<typeof vi.spyOn>;
    let resizeCallbacks: ResizeObserverCallback[];
    let originalMatchMedia: typeof globalThis.window.matchMedia | undefined;
    let originalResizeObserver: typeof globalThis.ResizeObserver | undefined;
    let reducedMotion = false;

    function internals(comp: MeteorsComponent): MeteorsInternals {
        return comp as unknown as MeteorsInternals;
    }

    function getComp(): MeteorsComponent {
        return fixture.debugElement.query(By.directive(MeteorsComponent))
            .componentInstance as MeteorsComponent;
    }

    function getHostEl(): HTMLElement {
        return fixture.debugElement.query(By.directive(MeteorsComponent))
            .nativeElement as HTMLElement;
    }

    function createFixture(): void {
        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    }

    beforeEach(async () => {
        reducedMotion = false;
        resizeCallbacks = [];

        originalMatchMedia = globalThis.window.matchMedia;
        globalThis.window.matchMedia = (vi.fn().mockImplementation(
            () => ({ matches: reducedMotion }) as unknown as MediaQueryList,
        ) as unknown) as typeof globalThis.window.matchMedia;

        originalResizeObserver = globalThis.ResizeObserver;
        globalThis.ResizeObserver = class {
            constructor(cb: ResizeObserverCallback) {
                resizeCallbacks.push(cb);
            }
            observe(): void {
                /* noop */
            }
            unobserve(): void {
                /* noop */
            }
            disconnect(): void {
                /* noop */
            }
        } as unknown as typeof globalThis.ResizeObserver;

        rafSpy = vi
            .spyOn(globalThis, 'requestAnimationFrame')
            .mockReturnValue(1 as unknown as number);

        const gradientStub = { addColorStop: vi.fn() };
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            createLinearGradient: vi.fn().mockReturnValue(gradientStub),
            createRadialGradient: vi.fn().mockReturnValue(gradientStub),
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            lineCap: 'butt',
            globalAlpha: 1,
        } as unknown as CanvasRenderingContext2D);

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (originalMatchMedia) {
            globalThis.window.matchMedia = originalMatchMedia;
        }
        if (originalResizeObserver) {
            globalThis.ResizeObserver = originalResizeObserver;
        }
    });

    describe('host rendering', () => {
        beforeEach(() => createFixture());

        it('should render with data-slot attribute', () => {
            expect(getHostEl().dataset['slot']).toBe('meteors');
        });

        it('should set host position to absolute', () => {
            expect(getHostEl().style.position).toBe('absolute');
        });

        it('should set host inset to 0', () => {
            expect(getHostEl().style.inset).toBe('0');
        });

        it('should set pointer-events to none', () => {
            expect(getHostEl().style.pointerEvents).toBe('none');
        });

        it('should create a canvas element inside host', () => {
            expect(getHostEl().querySelector('canvas')).toBeTruthy();
        });

        it('should start requestAnimationFrame loop', () => {
            expect(rafSpy).toHaveBeenCalled();
        });

        it('should populate the meteor field with count meteors', () => {
            expect(internals(getComp()).meteors).toHaveLength(10);
        });
    });

    describe('inputs', () => {
        beforeEach(() => createFixture());

        it('should accept count input', () => {
            expect(getComp().count()).toBe(10);
        });

        it('should accept and react to speed input', () => {
            const comp = getComp();
            expect(comp.speed()).toBe('medium');
            host.speed.set('fast');
            fixture.detectChanges();
            expect(comp.speed()).toBe('fast');
        });

        it('should accept color input', () => {
            expect(getComp().color()).toBe('white');
        });
    });

    describe('teardown', () => {
        beforeEach(() => createFixture());

        it('should cancel animation frame on destroy', () => {
            const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
            fixture.destroy();
            expect(cancelSpy).toHaveBeenCalledWith(1);
        });

        it('should remove canvas on destroy', () => {
            const hostEl = getHostEl();
            fixture.destroy();
            expect(hostEl.querySelector('canvas')).toBeFalsy();
        });
    });

    describe('reduced motion', () => {
        it('should not create a canvas when reduced motion is preferred', () => {
            const getContextSpy = HTMLCanvasElement.prototype.getContext as ReturnType<
                typeof vi.fn
            >;
            getContextSpy.mockClear?.();
            reducedMotion = true;
            createFixture();
            expect(getHostEl().querySelector('canvas')).toBeFalsy();
            expect(getContextSpy).not.toHaveBeenCalled();
        });
    });

    describe('speedMultiplier', () => {
        it('should return 0.5 for slow', () => {
            host = new TestHostComponent();
            fixture = TestBed.createComponent(TestHostComponent);
            fixture.componentInstance.speed.set('slow');
            fixture.detectChanges();
            expect(internals(getComp()).speedMultiplier()).toBe(0.5);
        });

        it('should return 2 for fast', () => {
            fixture = TestBed.createComponent(TestHostComponent);
            fixture.componentInstance.speed.set('fast');
            fixture.detectChanges();
            expect(internals(getComp()).speedMultiplier()).toBe(2);
        });

        it('should return 1 for medium', () => {
            createFixture();
            expect(internals(getComp()).speedMultiplier()).toBe(1);
        });
    });

    describe('resolveColor', () => {
        it('should keep white as full-intensity white', () => {
            createFixture();
            expect(internals(getComp()).rgb).toEqual({ r: 255, g: 255, b: 255 });
        });

        it('should resolve a non-white color into rgb components', () => {
            fixture = TestBed.createComponent(TestHostComponent);
            fixture.componentInstance.color.set('rgb(12, 34, 56)');
            fixture.detectChanges();
            const int = internals(getComp());
            int.resolveColor();
            expect(int.rgb).toEqual({ r: 12, g: 34, b: 56 });
        });

        it('should leave rgb unchanged when the computed color is not parseable', () => {
            fixture = TestBed.createComponent(TestHostComponent);
            fixture.componentInstance.color.set('somenamedcolor');
            fixture.detectChanges();
            const int = internals(getComp());
            vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
                color: 'transparent',
            } as unknown as CSSStyleDeclaration);
            int.rgb = { r: 1, g: 2, b: 3 };
            int.resolveColor();
            expect(int.rgb).toEqual({ r: 1, g: 2, b: 3 });
        });
    });

    describe('syncCanvasSize', () => {
        beforeEach(() => createFixture());

        it('should size the canvas to the host client box when non-zero', () => {
            const comp = getComp();
            const int = internals(comp);
            const hostEl = getHostEl();
            Object.defineProperty(hostEl, 'clientWidth', {
                configurable: true,
                get: () => 640,
            });
            Object.defineProperty(hostEl, 'clientHeight', {
                configurable: true,
                get: () => 480,
            });
            int.syncCanvasSize();
            expect(int.canvas?.width).toBe(640);
            expect(int.canvas?.height).toBe(480);
        });

        it('should be a no-op when there is no canvas', () => {
            const int = internals(getComp());
            int.canvas = null;
            expect(() => int.syncCanvasSize()).not.toThrow();
        });
    });

    describe('spawnMeteor', () => {
        let randomSpy: ReturnType<typeof vi.spyOn>;

        afterEach(() => randomSpy?.mockRestore());

        it('should spawn from the top band when random > 0.3', () => {
            createFixture();
            randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
            const m = internals(getComp()).spawnMeteor(false);
            expect(m.opacity).toBe(0);
            expect(m.fadeIn).toBe(true);
            expect(m.y).toBeLessThan(0);
        });

        it('should spawn from the right edge when random <= 0.3', () => {
            createFixture();
            randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
            const int = internals(getComp());
            const canvasWidth = int.canvas?.width ?? 0;
            const m = int.spawnMeteor(false);
            expect(m.x).toBeGreaterThan(canvasWidth);
        });

        it('should pre-advance and reveal the meteor when randomPhase is true', () => {
            createFixture();
            randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
            const m = internals(getComp()).spawnMeteor(true);
            expect(m.fadeIn).toBe(false);
            expect(m.opacity).toBe(m.maxOpacity);
            expect(m.opacity).toBeGreaterThan(0);
        });

        it('should fall back to default dimensions when the canvas is absent', () => {
            createFixture();
            randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
            const int = internals(getComp());
            int.canvas = null;
            const m = int.spawnMeteor(false);
            expect(Number.isFinite(m.x)).toBe(true);
            expect(Number.isFinite(m.vx)).toBe(true);
        });
    });

    describe('createMeteors', () => {
        it('should rebuild the meteor array to match count', () => {
            fixture = TestBed.createComponent(TestHostComponent);
            fixture.componentInstance.count.set(5);
            fixture.detectChanges();
            const int = internals(getComp());
            int.createMeteors();
            expect(int.meteors).toHaveLength(5);
        });
    });

    describe('outOfBounds', () => {
        beforeEach(() => createFixture());

        it('should report true when far outside the canvas', () => {
            const int = internals(getComp());
            expect(int.outOfBounds(makeMeteor({ x: -9999 }))).toBe(true);
        });

        it('should report false when within the canvas', () => {
            const int = internals(getComp());
            expect(int.outOfBounds(makeMeteor({ x: 10, y: 10 }))).toBe(false);
        });

        it('should fall back to default bounds when the canvas is absent', () => {
            const int = internals(getComp());
            int.canvas = null;
            expect(int.outOfBounds(makeMeteor({ x: 9999 }))).toBe(true);
        });
    });

    describe('drawMeteor', () => {
        beforeEach(() => createFixture());

        it('should build gradients and stroke/fill against the context', () => {
            const int = internals(getComp());
            const ctx = int.ctx as unknown as {
                createLinearGradient: ReturnType<typeof vi.fn>;
                createRadialGradient: ReturnType<typeof vi.fn>;
                stroke: ReturnType<typeof vi.fn>;
                fill: ReturnType<typeof vi.fn>;
            };
            int.drawMeteor(int.ctx as CanvasRenderingContext2D, makeMeteor());
            expect(ctx.createLinearGradient).toHaveBeenCalled();
            expect(ctx.createRadialGradient).toHaveBeenCalled();
            expect(ctx.stroke).toHaveBeenCalled();
            expect(ctx.fill).toHaveBeenCalled();
        });
    });

    describe('animate', () => {
        beforeEach(() => createFixture());

        it('should bail out early when the canvas is missing', () => {
            const int = internals(getComp());
            int.canvas = null;
            rafSpy.mockClear();
            int.animate();
            expect(rafSpy).not.toHaveBeenCalled();
        });

        it('should reschedule without drawing when the canvas has zero size', () => {
            const int = internals(getComp());
            const ctx = int.ctx as unknown as { clearRect: ReturnType<typeof vi.fn> };
            int.canvas = { width: 0, height: 0, remove: vi.fn() } as unknown as HTMLCanvasElement;
            rafSpy.mockClear();
            ctx.clearRect.mockClear();
            int.animate();
            expect(rafSpy).toHaveBeenCalled();
            expect(ctx.clearRect).not.toHaveBeenCalled();
        });

        it('should advance, fade, respawn and draw meteors in one frame', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5);
            const int = internals(getComp());
            int.canvas = { width: 300, height: 150, remove: vi.fn() } as unknown as HTMLCanvasElement;
            const ctx = int.ctx as unknown as {
                clearRect: ReturnType<typeof vi.fn>;
                fill: ReturnType<typeof vi.fn>;
            };
            ctx.clearRect.mockClear();

            const fadingIn = makeMeteor({ opacity: 0.02, maxOpacity: 0.5, fadeIn: true });
            const completing = makeMeteor({ opacity: 0.49, maxOpacity: 0.5, fadeIn: true });
            const escaping = makeMeteor({ x: -9999, y: 0, opacity: 0.5, fadeIn: false });
            const invisible = makeMeteor({ opacity: 0, fadeIn: false });
            int.meteors = [fadingIn, completing, escaping, invisible];

            int.animate();

            expect(ctx.clearRect).toHaveBeenCalled();
            expect(fadingIn.opacity).toBeCloseTo(0.06, 5);
            expect(completing.fadeIn).toBe(false);
            expect(completing.opacity).toBe(0.5);
            expect(int.meteors[2]).not.toBe(escaping);
            expect(ctx.fill).toHaveBeenCalled();
        });
    });

    describe('resize observer', () => {
        beforeEach(() => createFixture());

        it('should recreate meteors when the meteor field is empty on resize', () => {
            const int = internals(getComp());
            int.meteors = [];
            const entries = [] as unknown as ResizeObserverEntry[];
            resizeCallbacks[0](entries, {} as ResizeObserver);
            expect(int.meteors).toHaveLength(10);
        });

        it('should keep existing meteors when they are still present on resize', () => {
            const int = internals(getComp());
            const existing = int.meteors;
            resizeCallbacks[0]([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
            expect(int.meteors).toBe(existing);
        });
    });
});
