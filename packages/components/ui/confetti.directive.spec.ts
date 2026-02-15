import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { UiConfettiDirective } from './confetti.directive';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
    template: `<div uiConfetti>Content</div>`,
    imports: [UiConfettiDirective]
})
class TestHostComponent {}

describe('UiConfettiDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should set position relative on host element', () => {
        const hostEl = fixture.nativeElement.querySelector('[uiConfetti]') as HTMLElement;
        expect(hostEl.style.position).toBe('relative');
    });

    it('should set overflow hidden on host element', () => {
        const hostEl = fixture.nativeElement.querySelector('[uiConfetti]') as HTMLElement;
        expect(hostEl.style.overflow).toBe('hidden');
    });

    it('should create a canvas element inside the host', () => {
        const hostEl = fixture.nativeElement.querySelector('[uiConfetti]') as HTMLElement;
        const canvas = hostEl.querySelector('canvas');
        expect(canvas).toBeTruthy();
    });

    it('should style canvas as absolute positioned', () => {
        const hostEl = fixture.nativeElement.querySelector('[uiConfetti]') as HTMLElement;
        const canvas = hostEl.querySelector('canvas') as HTMLCanvasElement;
        expect(canvas.style.position).toBe('absolute');
        expect(canvas.style.pointerEvents).toBe('none');
    });
});
