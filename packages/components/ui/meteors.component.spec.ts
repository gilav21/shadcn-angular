import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MeteorsComponent } from './meteors.component';

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
    speed = signal<'slow' | 'medium' | 'fast'>('medium');
    color = signal('white');
}

describe('MeteorsComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let rafSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);

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

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render with data-slot attribute', () => {
        const hostEl = fixture.debugElement.query(By.directive(MeteorsComponent)).nativeElement as HTMLElement;
        expect(hostEl.dataset['slot']).toBe('meteors');
    });

    it('should set host position to absolute', () => {
        const hostEl = fixture.debugElement.query(By.directive(MeteorsComponent)).nativeElement as HTMLElement;
        expect(hostEl.style.position).toBe('absolute');
    });

    it('should set host inset to 0', () => {
        const hostEl = fixture.debugElement.query(By.directive(MeteorsComponent)).nativeElement as HTMLElement;
        expect(hostEl.style.inset).toBe('0px');
    });

    it('should set pointer-events to none', () => {
        const hostEl = fixture.debugElement.query(By.directive(MeteorsComponent)).nativeElement as HTMLElement;
        expect(hostEl.style.pointerEvents).toBe('none');
    });

    it('should create a canvas element inside host', () => {
        const hostEl = fixture.debugElement.query(By.directive(MeteorsComponent)).nativeElement as HTMLElement;
        expect(hostEl.querySelector('canvas')).toBeTruthy();
    });

    it('should start requestAnimationFrame loop', () => {
        expect(rafSpy).toHaveBeenCalled();
    });

    it('should accept count input', () => {
        const comp = fixture.debugElement.query(By.directive(MeteorsComponent)).componentInstance as MeteorsComponent;
        expect(comp.count()).toBe(10);
    });

    it('should accept speed input', () => {
        const comp = fixture.debugElement.query(By.directive(MeteorsComponent)).componentInstance as MeteorsComponent;
        expect(comp.speed()).toBe('medium');
        host.speed.set('fast');
        fixture.detectChanges();
        expect(comp.speed()).toBe('fast');
    });

    it('should accept color input', () => {
        const comp = fixture.debugElement.query(By.directive(MeteorsComponent)).componentInstance as MeteorsComponent;
        expect(comp.color()).toBe('white');
    });

    it('should cancel animation frame on destroy', () => {
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        fixture.destroy();
        expect(cancelSpy).toHaveBeenCalled();
    });

    it('should remove canvas on destroy', () => {
        const hostEl = fixture.debugElement.query(By.directive(MeteorsComponent)).nativeElement as HTMLElement;
        fixture.destroy();
        expect(hostEl.querySelector('canvas')).toBeFalsy();
    });
});
