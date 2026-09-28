import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertComponent, AlertTitleComponent, AlertDescriptionComponent } from './alert.component';
import { Component, signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';

// Test host component for integration tests
@Component({
    template: `
        <ui-alert [variant]="variant()">
            <ui-alert-title>Alert Title</ui-alert-title>
            <ui-alert-description>Alert Description</ui-alert-description>
        </ui-alert>
    `,
    imports: [AlertComponent, AlertTitleComponent, AlertDescriptionComponent]
})
class TestHostComponent {
    variant = signal<'default' | 'destructive'>('default');
}

describe('AlertComponent', () => {
    let fixture: ComponentFixture<AlertComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AlertComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AlertComponent);
        fixture.detectChanges();
    });

    it('should have role="status" + aria-live="polite" for the default variant', () => {
        expect(fixture.nativeElement.getAttribute('role')).toBe('status');
        expect(fixture.nativeElement.getAttribute('aria-live')).toBe('polite');
    });

    it('should have assertive role="alert" for the destructive variant', () => {
        fixture.componentRef.setInput('variant', 'destructive');
        fixture.detectChanges();
        expect(fixture.nativeElement.getAttribute('role')).toBe('alert');
        expect(fixture.nativeElement.getAttribute('aria-live')).toBe('assertive');
    });

    it('should have data-slot="alert"', () => {
        expect(fixture.nativeElement.dataset.slot).toBe('alert');
    });

    it('should apply default variant classes', () => {
        expect(fixture.nativeElement.className).toContain('bg-background');
        expect(fixture.nativeElement.className).toContain('text-foreground');
    });

    it('should apply destructive variant classes', () => {
        fixture.componentRef.setInput('variant', 'destructive');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('text-destructive');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-custom-alert');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('my-custom-alert');
    });
});

describe('AlertTitleComponent', () => {
    let fixture: ComponentFixture<AlertTitleComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AlertTitleComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AlertTitleComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="alert-title"', () => {
        expect(fixture.nativeElement.dataset.slot).toBe('alert-title');
    });
});

describe('AlertDescriptionComponent', () => {
    let fixture: ComponentFixture<AlertDescriptionComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AlertDescriptionComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AlertDescriptionComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="alert-description"', () => {
        expect(fixture.nativeElement.dataset.slot).toBe('alert-description');
    });
});

describe('Alert Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render alert with title and description', () => {
        const parts = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('ui-alert-title, ui-alert-description'))
            .map(el => el.textContent?.trim());
        expect(parts).toEqual(['Alert Title', 'Alert Description']);

        const simple = TestBed.createComponent(AlertComponent);
        const root = simple.nativeElement as HTMLElement;
        const slotText = (slot: string): string | undefined =>
            root.querySelector(`[data-slot="${slot}"]`)?.textContent?.trim();
        simple.componentRef.setInput('description', 'Your session expires in 5 minutes.');
        simple.detectChanges();
        // The description renders only under a title.
        expect(slotText('alert-description')).toBeUndefined();

        simple.componentRef.setInput('description', '');
        simple.componentRef.setInput('title', 'Heads up!');
        simple.detectChanges();
        expect(slotText('alert-title')).toBe('Heads up!');
        expect(root.querySelector('[data-slot="alert-description"]')).toBeNull();

        simple.componentRef.setInput('description', 'Your session expires in 5 minutes.');
        simple.detectChanges();
        expect(slotText('alert-description')).toBe('Your session expires in 5 minutes.');
    });
});
