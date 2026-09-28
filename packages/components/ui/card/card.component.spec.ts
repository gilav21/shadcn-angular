import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, CardFooterComponent } from './index';
import { Component } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';

// Test host component for integration tests
@Component({
    template: `
        <ui-card>
            <ui-card-header>
                <ui-card-title>Card Title</ui-card-title>
                <ui-card-description>Card Description</ui-card-description>
            </ui-card-header>
            <ui-card-content>Card Content</ui-card-content>
            <ui-card-footer>Card Footer</ui-card-footer>
        </ui-card>
    `,
    imports: [CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, CardFooterComponent]
})
class TestHostComponent { }

describe('CardComponent', () => {
    let fixture: ComponentFixture<CardComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CardComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CardComponent);
        fixture.detectChanges();
    });

    it('should swap the card surface for a skeleton while skeleton is set', () => {
        fixture.componentRef.setInput('title', 'Revenue');
        fixture.detectChanges();
        const host = fixture.nativeElement as HTMLElement;
        expect(host.className).toContain('bg-card');
        expect(host.className).toContain('shadow-sm');
        expect(host.dataset['skeleton']).toBeUndefined();
        expect(host.textContent).toContain('Revenue');

        fixture.componentRef.setInput('skeleton', true);
        fixture.detectChanges();
        expect(host.className).not.toContain('bg-card');
        expect(host.className).not.toContain('shadow-sm');
        expect(host.dataset['skeleton']).toBe('true');
        expect(host.querySelector('ui-skeleton')).not.toBeNull();
        expect(host.textContent).not.toContain('Revenue');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-card');
        fixture.detectChanges();
        expect(fixture.nativeElement.className).toContain('my-card');
    });
});

describe('CardContentComponent', () => {
    let fixture: ComponentFixture<CardContentComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CardContentComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CardContentComponent);
        fixture.detectChanges();
    });

    it('should forward custom classes', () => {
        fixture.componentRef.setInput('class', 'custom-content');
        fixture.detectChanges();
        expect(fixture.nativeElement.className).toContain('custom-content');
    });
});

describe('Card Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render complete card structure', () => {
        // The card density CSS keys on these data-slot hooks.
        const root = fixture.nativeElement as HTMLElement;
        const slot = (name: string): HTMLElement | null => root.querySelector(`[data-slot="${name}"]`);
        expect(slot('card')?.contains(slot('card-header'))).toBe(true);
        expect(slot('card-header')?.contains(slot('card-title'))).toBe(true);
        expect(slot('card-header')?.contains(slot('card-description'))).toBe(true);
        expect(slot('card-title')?.textContent?.trim()).toBe('Card Title');
        expect(slot('card-description')?.textContent?.trim()).toBe('Card Description');
        expect(slot('card-content')?.textContent?.trim()).toBe('Card Content');
        expect(slot('card-footer')?.textContent?.trim()).toBe('Card Footer');
    });
});
