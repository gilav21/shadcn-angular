import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpinnerComponent, PageSpinnerComponent } from './spinner.component';
import { Component } from '@angular/core';
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

    it('should have status role', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.getAttribute('role')).toBe('status');
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
});

describe('PageSpinnerComponent', () => {
    let fixture: ComponentFixture<PageSpinnerComponent>;
    let component: PageSpinnerComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PageSpinnerComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PageSpinnerComponent);
        component = fixture.componentInstance;
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
