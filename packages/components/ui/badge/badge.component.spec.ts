import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeComponent } from './badge.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('BadgeComponent', () => {
    let component: BadgeComponent;
    let fixture: ComponentFixture<BadgeComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BadgeComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(BadgeComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="badge"', () => {
        expect(fixture.nativeElement.dataset['slot']).toBe('badge');
    });

    it('should apply base classes', () => {
        expect(fixture.nativeElement.className).toContain('inline-flex');
        expect(fixture.nativeElement.className).toContain('items-center');
        expect(fixture.nativeElement.className).toContain('rounded-md');
        expect(fixture.nativeElement.className).toContain('text-xs');
        expect(fixture.nativeElement.className).toContain('font-semibold');
    });

    it('should apply default variant classes', () => {
        expect(fixture.nativeElement.className).toContain('bg-primary');
        expect(fixture.nativeElement.className).toContain('text-primary-foreground');
    });

    it('should apply secondary variant classes', () => {
        fixture.componentRef.setInput('variant', 'secondary');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('bg-secondary');
        expect(fixture.nativeElement.className).toContain('text-secondary-foreground');
    });

    it('should apply destructive variant classes', () => {
        fixture.componentRef.setInput('variant', 'destructive');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('bg-destructive');
        expect(fixture.nativeElement.className).toContain('text-destructive-foreground');
    });

    it('should apply outline variant classes', () => {
        fixture.componentRef.setInput('variant', 'outline');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('text-foreground');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'custom-badge');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('custom-badge');
    });

    it('should render skeleton classes and skeleton element when skeleton=true', () => {
        fixture.componentRef.setInput('skeleton', true);
        fixture.componentRef.setInput('class', 'skeleton-extra');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('inline-flex');
        expect(fixture.nativeElement.className).toContain('skeleton-extra');
        expect(fixture.nativeElement.className).not.toContain('bg-primary');
        expect(fixture.nativeElement.querySelector('ui-skeleton')).toBeTruthy();
    });

    it('should render label text when label is set', () => {
        fixture.componentRef.setInput('label', 'New');
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent.trim()).toBe('New');
    });

    it('toString() returns the label', () => {
        fixture.componentRef.setInput('label', 'Beta');
        fixture.detectChanges();

        expect(component.toString()).toBe('Beta');
    });

    it('toString() returns empty string for default (empty) label', () => {
        expect(component.toString()).toBe('');
    });
});
