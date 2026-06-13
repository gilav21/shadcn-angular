import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { UiConfettiDirective, ConfettiOptions } from './confetti.directive';
import { describe, it, expect, beforeEach, vi, afterEach, afterAll } from 'vitest';

// Capture the real getContext before mocking so it can be restored when this
// file's tests finish — otherwise the stub leaks to other specs in the shared
// browser worker (e.g. color-extract, which needs a real 2D context).
const NATIVE_GET_CONTEXT = HTMLCanvasElement.prototype.getContext;
afterAll(() => {
    HTMLCanvasElement.prototype.getContext = NATIVE_GET_CONTEXT;
});

function mockCanvasContext(): void {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const noopFn = () => {};
    const mockCtx = {
        clearRect: noopFn,
        beginPath: noopFn,
        fill: noopFn,
        ellipse: noopFn,
        fillRect: noopFn,
        save: noopFn,
        restore: noopFn,
        translate: noopFn,
        rotate: noopFn,
        scale: noopFn,
        fillStyle: '',
        globalAlpha: 1,
    };
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
        if (contextId === '2d') {
            return mockCtx as unknown as CanvasRenderingContext2D;
        }
        return originalGetContext.call(this, contextId as any);
    } as typeof originalGetContext;
}

mockCanvasContext();

@Component({
    template: `<div uiConfetti>Content</div>`,
    imports: [UiConfettiDirective]
})
class TestHostComponent {}

@Component({
    template: `<div uiConfetti [options]="opts">Content</div>`,
    imports: [UiConfettiDirective]
})
class OptionsTestHostComponent {
    opts: ConfettiOptions = { zIndex: 50 };
}

@Component({
    template: `<div uiConfetti [manualTrigger]="trigger()" [options]="opts">Content</div>`,
    imports: [UiConfettiDirective]
})
class TriggerTestHostComponent {
    trigger = signal(false);
    opts: ConfettiOptions = { particleCount: 20 };
}

@Component({
    template: `<div uiConfetti [options]="opts">Content</div>`,
    imports: [UiConfettiDirective]
})
class CustomParticleCountHostComponent {
    opts: ConfettiOptions = { particleCount: 10 };
}

describe('UiConfettiDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((_cb) => {
            return 1 as unknown as number;
        });

        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should set position relative on host element', () => {
        const hostEl = (fixture.nativeElement as HTMLElement).querySelector('[uiConfetti]') as HTMLElement;
        expect(hostEl.style.position).toBe('relative');
    });

    it('should set overflow hidden on host element', () => {
        const hostEl = (fixture.nativeElement as HTMLElement).querySelector('[uiConfetti]') as HTMLElement;
        expect(hostEl.style.overflow).toBe('hidden');
    });

    it('should create a canvas element inside the host', () => {
        const hostEl = (fixture.nativeElement as HTMLElement).querySelector('[uiConfetti]') as HTMLElement;
        const canvas = hostEl.querySelector('canvas');
        expect(canvas).toBeTruthy();
    });

    it('should style canvas as absolute positioned', () => {
        const hostEl = (fixture.nativeElement as HTMLElement).querySelector('[uiConfetti]') as HTMLElement;
        const canvas = hostEl.querySelector('canvas') as HTMLCanvasElement;
        expect(canvas.style.position).toBe('absolute');
        expect(canvas.style.pointerEvents).toBe('none');
    });

    it('should set default z-index of 100 on canvas', () => {
        const hostEl = (fixture.nativeElement as HTMLElement).querySelector('[uiConfetti]') as HTMLElement;
        const canvas = hostEl.querySelector('canvas') as HTMLCanvasElement;
        expect(canvas.style.zIndex).toBe('100');
    });

    it('should create particles when fire() is called', () => {
        const directiveEl = fixture.debugElement.query(By.directive(UiConfettiDirective));
        const directive = directiveEl.injector.get(UiConfettiDirective);

        directive.fire();

        const particles = (directive as any)._particles;
        expect(particles.length).toBeGreaterThan(0);
    });

    it('should start animation when fire() is called', () => {
        const directiveEl = fixture.debugElement.query(By.directive(UiConfettiDirective));
        const directive = directiveEl.injector.get(UiConfettiDirective);

        directive.fire();

        const animationFrameId = (directive as any)._animationFrameId;
        expect(animationFrameId).not.toBeNull();
    });

    it('should create exactly 50 particles with default options', () => {
        const directiveEl = fixture.debugElement.query(By.directive(UiConfettiDirective));
        const directive = directiveEl.injector.get(UiConfettiDirective);

        directive.fire();

        const particles = (directive as any)._particles;
        expect(particles.length).toBe(50);
    });

    it('should stop animation and clear particles on destroy', () => {
        const directiveEl = fixture.debugElement.query(By.directive(UiConfettiDirective));
        const directive = directiveEl.injector.get(UiConfettiDirective);

        directive.fire();
        expect((directive as any)._animationFrameId).not.toBeNull();
        expect((directive as any)._particles.length).toBeGreaterThan(0);

        fixture.destroy();

        expect((directive as any)._animationFrameId).toBeNull();
        expect((directive as any)._particles.length).toBe(0);
    });

    it('should remove canvas from DOM on destroy', () => {
        const hostEl = (fixture.nativeElement as HTMLElement).querySelector('[uiConfetti]') as HTMLElement;
        expect(hostEl.querySelector('canvas')).toBeTruthy();

        fixture.destroy();

        expect(hostEl.querySelector('canvas')).toBeFalsy();
    });
});

describe('UiConfettiDirective with custom z-index', () => {
    let fixture: ComponentFixture<OptionsTestHostComponent>;

    beforeEach(async () => {
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1 as unknown as number);

        await TestBed.configureTestingModule({
            imports: [OptionsTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(OptionsTestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should set canvas z-index from options', () => {
        const hostEl = (fixture.nativeElement as HTMLElement).querySelector('[uiConfetti]') as HTMLElement;
        const canvas = hostEl.querySelector('canvas') as HTMLCanvasElement;
        expect(canvas.style.zIndex).toBe('50');
    });
});

describe('UiConfettiDirective with custom particle count', () => {
    let fixture: ComponentFixture<CustomParticleCountHostComponent>;

    beforeEach(async () => {
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1 as unknown as number);

        await TestBed.configureTestingModule({
            imports: [CustomParticleCountHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CustomParticleCountHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should create the specified number of particles from options', () => {
        const directiveEl = fixture.debugElement.query(By.directive(UiConfettiDirective));
        const directive = directiveEl.injector.get(UiConfettiDirective);

        directive.fire();

        const particles = (directive as any)._particles;
        expect(particles.length).toBe(10);
    });
});

describe('UiConfettiDirective with manualTrigger', () => {
    let fixture: ComponentFixture<TriggerTestHostComponent>;

    beforeEach(async () => {
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1 as unknown as number);

        await TestBed.configureTestingModule({
            imports: [TriggerTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TriggerTestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should fire confetti when manualTrigger changes to true', () => {
        const directiveEl = fixture.debugElement.query(By.directive(UiConfettiDirective));
        const directive = directiveEl.injector.get(UiConfettiDirective);

        expect((directive as any)._particles.length).toBe(0);

        fixture.componentInstance.trigger.set(true);
        fixture.detectChanges();

        const particles = (directive as any)._particles;
        expect(particles.length).toBe(20);
    });

    it('should not fire on initial render when manualTrigger is false', () => {
        const directiveEl = fixture.debugElement.query(By.directive(UiConfettiDirective));
        const directive = directiveEl.injector.get(UiConfettiDirective);

        expect((directive as any)._particles.length).toBe(0);
    });
});
