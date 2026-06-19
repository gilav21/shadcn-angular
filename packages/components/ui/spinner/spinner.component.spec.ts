import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { SpinnerComponent } from './spinner.component';
import { PageSpinnerComponent } from './sub/page-spinner.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SpinnerComponent', () => {
    let fixture: ComponentFixture<SpinnerComponent>;
    let component: SpinnerComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SpinnerComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SpinnerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('exposes a live status region via a native <output> (implicit role="status")', () => {
        const status = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
        expect(status.nativeElement.tagName).toBe('OUTPUT');
        expect(status.nativeElement.getAttribute('aria-label')).toBe('Loading');
    });

    it('should have default size classes', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.getAttribute('class')).toContain('h-5');
        expect(svg.nativeElement.getAttribute('class')).toContain('w-5');
    });

    it('should apply large size class', () => {
        fixture.componentRef.setInput('size', 'lg');
        fixture.detectChanges();
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.getAttribute('class')).toContain('h-6');
        expect(svg.nativeElement.getAttribute('class')).toContain('w-6');
    });

    it('should apply custom size via style', () => {
        fixture.componentRef.setInput('customSize', 48);
        fixture.detectChanges();
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.style.width).toBe('48px');
        expect(svg.nativeElement.style.height).toBe('48px');
        // Preset classes should be gone
        expect(svg.nativeElement.className).not.toContain('h-5');
    });

    it('should have animate-spin class', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.getAttribute('class')).toContain('animate-spin');
    });

    it('should default to ring variant', () => {
        expect(component.variant()).toBe('ring');
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg).toBeTruthy();
    });

    describe('dots variant', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('variant', 'dots');
            fixture.detectChanges();
        });

        it('should render three bouncing dots', () => {
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            expect(container).toBeTruthy();
            const dots = container.queryAll(By.css('div'));
            expect(dots).toHaveLength(3);
        });

        it('exposes the dots container as a native <output> (implicit role="status")', () => {
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            expect(container.nativeElement.tagName).toBe('OUTPUT');
        });

        it('should apply correct dot size for sm', () => {
            fixture.componentRef.setInput('size', 'sm');
            fixture.detectChanges();
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            const dot = container.queryAll(By.css('div'))[0];
            expect(dot.nativeElement.className).toContain('h-1.5');
            expect(dot.nativeElement.className).toContain('w-1.5');
        });

        it('should not render svg ring', () => {
            const svg = fixture.debugElement.query(By.css('svg'));
            expect(svg).toBeNull();
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
            const bars = container.queryAll(By.css('div'));
            expect(bars).toHaveLength(5);
        });

        it('exposes the bars container as a native <output> (implicit role="status")', () => {
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            expect(container.nativeElement.tagName).toBe('OUTPUT');
        });

        it('should apply staggered animation delays to bars', () => {
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            const bars = container.queryAll(By.css('div'));
            expect(bars[0].nativeElement.style.animationDelay).toBe('0s');
            expect(bars[1].nativeElement.style.animationDelay).toBe('0.1s');
            expect(bars[4].nativeElement.style.animationDelay).toBe('0.4s');
        });

        it('should apply correct bar size for lg', () => {
            fixture.componentRef.setInput('size', 'lg');
            fixture.detectChanges();
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            const bar = container.queryAll(By.css('div'))[0];
            expect(bar.nativeElement.className).toContain('w-1.5');
            expect(bar.nativeElement.className).toContain('h-6');
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
        });

        it('exposes the pulse container as a native <output> (implicit role="status")', () => {
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            expect(container.nativeElement.tagName).toBe('OUTPUT');
        });

        it('should apply correct pulse size for xl', () => {
            fixture.componentRef.setInput('size', 'xl');
            fixture.detectChanges();
            const container = fixture.debugElement.query(By.css('[data-slot="spinner"]'));
            expect(container.nativeElement.className).toContain('h-8');
            expect(container.nativeElement.className).toContain('w-8');
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

    it('should render projected content', () => {
        const custom = fixture.debugElement.query(By.css('.custom-loader'));
        expect(custom).toBeTruthy();
        expect(custom.nativeElement.textContent).toBe('Custom');
    });

    it('should hide built-in spinner when content is projected', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg).toBeNull();
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

    it('should render page spinner overlay', () => {
        const container = fixture.debugElement.query(By.css('[data-slot="page-spinner"]'));
        expect(container).toBeTruthy();
        expect(container.nativeElement.className).toContain('fixed');
        expect(container.nativeElement.className).toContain('inset-0');
    });

    it('should render message when provided', () => {
        fixture.componentRef.setInput('message', 'Loading data...');
        fixture.detectChanges();
        const p = fixture.debugElement.query(By.css('p'));
        expect(p.nativeElement.textContent).toBe('Loading data...');
    });
});
