import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { ParticlesComponent } from './particles.component';

// Capture the real getContext before mocking so it can be restored when this
// file's tests finish — otherwise the stub leaks to other specs in the shared
// browser worker (e.g. color-extract, which needs a real 2D context).
const NATIVE_GET_CONTEXT = HTMLCanvasElement.prototype.getContext;
afterAll(() => {
    HTMLCanvasElement.prototype.getContext = NATIVE_GET_CONTEXT;
});

function setupCanvasMock(): void {
    const noopFn = () => {};
    const mockCtx = {
        clearRect: noopFn,
        beginPath: noopFn,
        arc: noopFn,
        fill: noopFn,
        moveTo: noopFn,
        lineTo: noopFn,
        stroke: noopFn,
        fillStyle: '',
        strokeStyle: '',
        globalAlpha: 1,
        lineWidth: 0.5,
    };
    HTMLCanvasElement.prototype.getContext = function (contextId: string) {
        if (contextId === '2d') return mockCtx as unknown as CanvasRenderingContext2D;
        return null;
    } as typeof HTMLCanvasElement.prototype.getContext;
}

setupCanvasMock();

@Component({
    template: `
        <ui-particles
            [count]="count()"
            [color]="color()"
            [speed]="speed()"
            [connectDistance]="connectDistance()"
            [mouseInteraction]="mouseInteraction()"
            style="width:200px;height:200px;display:block"
        />
    `,
    imports: [ParticlesComponent],
})
class TestHostComponent {
    count = signal(20);
    color = signal('hsl(var(--foreground))');
    speed = signal(0.5);
    connectDistance = signal(120);
    mouseInteraction = signal(true);
}

describe('ParticlesComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1 as unknown as number);
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should create a canvas element inside the host', () => {
        const hostEl = fixture.debugElement.query(By.directive(ParticlesComponent)).nativeElement as HTMLElement;
        const canvas = hostEl.querySelector('canvas');
        expect(canvas).toBeTruthy();
    });

    it('should append the canvas as a child of the host element', () => {
        const hostEl = fixture.debugElement.query(By.directive(ParticlesComponent)).nativeElement as HTMLElement;
        const canvas = hostEl.querySelector<HTMLCanvasElement>('canvas');
        expect(canvas!.parentElement).toBe(hostEl);
    });

    it('should set canvas position to absolute', () => {
        const hostEl = fixture.debugElement.query(By.directive(ParticlesComponent)).nativeElement as HTMLElement;
        const canvas = hostEl.querySelector<HTMLCanvasElement>('canvas');
        expect(canvas!.style.position).toBe('absolute');
    });

    it('should set canvas pointerEvents to none', () => {
        const hostEl = fixture.debugElement.query(By.directive(ParticlesComponent)).nativeElement as HTMLElement;
        const canvas = hostEl.querySelector<HTMLCanvasElement>('canvas');
        expect(canvas!.style.pointerEvents).toBe('none');
    });

    it('should set data-slot attribute on host', () => {
        const hostEl = fixture.debugElement.query(By.directive(ParticlesComponent)).nativeElement as HTMLElement;
        expect(hostEl.dataset['slot']).toBe('particles');
    });

    it('should set host position to absolute', () => {
        const hostEl = fixture.debugElement.query(By.directive(ParticlesComponent)).nativeElement as HTMLElement;
        expect(hostEl.style.position).toBe('absolute');
    });

    it('should remove the canvas element when the component is destroyed', () => {
        const hostEl = fixture.debugElement.query(By.directive(ParticlesComponent)).nativeElement as HTMLElement;
        expect(hostEl.querySelector('canvas')).toBeTruthy();

        fixture.destroy();

        expect(hostEl.querySelector('canvas')).toBeFalsy();
    });

    it('should accept count input', () => {
        const comp = fixture.debugElement.query(By.directive(ParticlesComponent)).componentInstance as ParticlesComponent;
        expect(comp.count()).toBe(20);
    });

    it('should accept color input', () => {
        const comp = fixture.debugElement.query(By.directive(ParticlesComponent)).componentInstance as ParticlesComponent;
        expect(comp.color()).toBe('hsl(var(--foreground))');
    });

    it('should accept mouseInteraction input', () => {
        const comp = fixture.debugElement.query(By.directive(ParticlesComponent)).componentInstance as ParticlesComponent;
        expect(comp.mouseInteraction()).toBe(true);
    });
});

describe('ParticlesComponent reduced motion behavior', () => {
    @Component({
        template: `<ui-particles style="width:200px;height:200px;display:block" />`,
        imports: [ParticlesComponent],
    })
    class ReducedMotionHostComponent {}

    let fixture: ComponentFixture<ReducedMotionHostComponent>;

    beforeEach(async () => {
        vi.spyOn(globalThis, 'matchMedia').mockReturnValue({
            matches: true,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        } as MediaQueryList);

        await TestBed.configureTestingModule({
            imports: [ReducedMotionHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ReducedMotionHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should not create a canvas when reduced motion is preferred', () => {
        const hostEl = fixture.debugElement.query(By.directive(ParticlesComponent)).nativeElement as HTMLElement;
        const canvas = hostEl.querySelector('canvas');
        expect(canvas).toBeFalsy();
    });

    it('should not have particles in the internal state when reduced motion is preferred', () => {
        const comp = fixture.debugElement.query(By.directive(ParticlesComponent)).componentInstance as ParticlesComponent;
        const particles = (comp as unknown as { particles: unknown[] })['particles'];
        expect(particles.length).toBe(0);
    });

    it('should still set the data-slot attribute even with reduced motion', () => {
        const hostEl = fixture.debugElement.query(By.directive(ParticlesComponent)).nativeElement as HTMLElement;
        expect(hostEl.dataset['slot']).toBe('particles');
    });

    it('should not call the animate method when reduced motion is preferred', () => {
        const comp = fixture.debugElement.query(By.directive(ParticlesComponent)).componentInstance as ParticlesComponent;
        const animFrameId = (comp as unknown as { animationFrameId: number | null })['animationFrameId'];
        expect(animFrameId).toBeNull();
    });
});
