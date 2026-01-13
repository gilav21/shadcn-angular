import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertComponent, AlertTitleComponent, AlertDescriptionComponent } from './alert.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
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
    let component: AlertComponent;
    let fixture: ComponentFixture<AlertComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AlertComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AlertComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have role="alert"', () => {
        expect(fixture.nativeElement.getAttribute('role')).toBe('alert');
    });

    it('should have data-slot="alert"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('alert');
    });

    it('should apply base classes', () => {
        expect(fixture.nativeElement.className).toContain('w-full');
        expect(fixture.nativeElement.className).toContain('rounded-lg');
        expect(fixture.nativeElement.className).toContain('border');
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
    let component: AlertTitleComponent;
    let fixture: ComponentFixture<AlertTitleComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AlertTitleComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AlertTitleComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="alert-title"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('alert-title');
    });

    it('should apply default classes', () => {
        expect(fixture.nativeElement.className).toContain('font-medium');
        expect(fixture.nativeElement.className).toContain('leading-none');
    });
});

describe('AlertDescriptionComponent', () => {
    let component: AlertDescriptionComponent;
    let fixture: ComponentFixture<AlertDescriptionComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AlertDescriptionComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AlertDescriptionComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="alert-description"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('alert-description');
    });

    it('should apply default classes', () => {
        expect(fixture.nativeElement.className).toContain('text-sm');
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
        const alert = fixture.debugElement.query(By.directive(AlertComponent));
        const title = fixture.debugElement.query(By.directive(AlertTitleComponent));
        const description = fixture.debugElement.query(By.directive(AlertDescriptionComponent));

        expect(alert).toBeTruthy();
        expect(title).toBeTruthy();
        expect(description).toBeTruthy();
    });

    it('should switch variant correctly', async () => {
        fixture.componentInstance.variant.set('destructive');
        fixture.detectChanges();
        await fixture.whenStable();

        const alert = fixture.debugElement.query(By.directive(AlertComponent));
        expect(alert.nativeElement.className).toContain('text-destructive');
    });
});
