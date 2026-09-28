import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { SpinnerComponent } from './spinner.component';
import { PageSpinnerComponent } from './sub/page-spinner.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SpinnerComponent', () => {
    let fixture: ComponentFixture<SpinnerComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SpinnerComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SpinnerComponent);
        fixture.detectChanges();
    });

    it('exposes a live status region via a native <output> (implicit role="status")', () => {
        const status = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
        expect(status.nativeElement.tagName).toBe('OUTPUT');
        expect(status.nativeElement.getAttribute('aria-label')).toBe('Loading');
    });

    it('should apply custom size via style', () => {
        fixture.componentRef.setInput('customSize', 48);
        fixture.detectChanges();
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.style.width).toBe('48px');
        expect(svg.nativeElement.style.height).toBe('48px');
        // Preset classes should be gone (SVGElement.className is an
        // SVGAnimatedString across runners — read the class attribute instead).
        expect(svg.nativeElement.getAttribute('class') ?? '').not.toContain('h-5');
    });

    describe('dots variant', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('variant', 'dots');
            fixture.detectChanges();
        });

        it('should render three bouncing dots', () => {
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            expect(container).toBeTruthy();
            expect(container.nativeElement.tagName).toBe('OUTPUT');
            const dots = container.queryAll(By.css('div'));
            expect(dots).toHaveLength(3);
            expect(fixture.debugElement.query(By.css('svg'))).toBeNull();
        });
    });

    describe('bars variant', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('variant', 'bars');
            fixture.detectChanges();
        });

        it('should render five bars', () => {
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            expect(container).toBeTruthy();
            expect(container.nativeElement.tagName).toBe('OUTPUT');
            const bars = container.queryAll(By.css('div'));
            expect(bars).toHaveLength(5);
        });

        it('should apply staggered animation delays to bars', () => {
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            const bars = container.queryAll(By.css('div'));
            expect(bars[0].nativeElement.style.animationDelay).toBe('0s');
            expect(bars[1].nativeElement.style.animationDelay).toBe('0.1s');
            expect(bars[4].nativeElement.style.animationDelay).toBe('0.4s');
        });
    });

    describe('pulse variant', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('variant', 'pulse');
            fixture.detectChanges();
        });

        it('should render a pulsing circle', () => {
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            expect(container).toBeTruthy();
            expect(container.nativeElement.className).toContain('rounded-full');
            expect(container.nativeElement.className).toContain('animate-pulse');
            expect(container.nativeElement.tagName).toBe('OUTPUT');
        });
    });
});

@Component({
    template: `<ui-spinner><div class="custom-loader">Custom</div></ui-spinner>`,
    imports: [SpinnerComponent],
    standalone: true,
})
class SpinnerWithCustomContentComponent {}

describe('SpinnerComponent with custom content', () => {
    let fixture: ComponentFixture<SpinnerWithCustomContentComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SpinnerWithCustomContentComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SpinnerWithCustomContentComponent);
        fixture.detectChanges();
    });

    it('should hide built-in spinner when content is projected', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg).toBeNull();
        const custom = fixture.debugElement.query(By.css('.custom-loader'));
        expect(custom.nativeElement.textContent).toBe('Custom');
    });
});

describe('PageSpinnerComponent', () => {
    let fixture: ComponentFixture<PageSpinnerComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PageSpinnerComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PageSpinnerComponent);
        fixture.detectChanges();
    });

    it('should render message when provided', () => {
        fixture.componentRef.setInput('message', 'Loading data...');
        fixture.detectChanges();
        const p = fixture.debugElement.query(By.css('p'));
        expect(p.nativeElement.textContent).toBe('Loading data...');
    });
});
