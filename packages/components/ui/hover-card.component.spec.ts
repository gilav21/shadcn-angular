import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HoverCardComponent, HoverCardTriggerComponent, HoverCardContentComponent } from './hover-card.component';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Basic test host
@Component({
    template: `
        <ui-hover-card>
            <ui-hover-card-trigger>
                <button>Hover me</button>
            </ui-hover-card-trigger>
            <ui-hover-card-content>
                <div class="p-4">
                    <h4>Hover Card Content</h4>
                    <p>Some description here.</p>
                </div>
            </ui-hover-card-content>
        </ui-hover-card>
    `,
    imports: [HoverCardComponent, HoverCardTriggerComponent, HoverCardContentComponent]
})
class TestHostComponent { }

describe('HoverCardComponent', () => {
    let component: HoverCardComponent;
    let fixture: ComponentFixture<HoverCardComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [HoverCardComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(HoverCardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
    });

    it('should show with delay', async () => {
        component.show();
        expect(component.open()).toBe(false); // Should not open immediately

        await new Promise(resolve => setTimeout(resolve, 250)); // > 200ms
        expect(component.open()).toBe(true);
    });

    it('should hide with delay', async () => {
        component.show();
        await new Promise(resolve => setTimeout(resolve, 250));
        expect(component.open()).toBe(true);

        component.hide();
        expect(component.open()).toBe(true); // Should not close immediately

        await new Promise(resolve => setTimeout(resolve, 350)); // > 300ms
        expect(component.open()).toBe(false);
    });
});

describe('HoverCard Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="hover-card-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should not show content initially', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="hover-card-content"]'));
        expect(content).toBeNull();
    });

    it('should show content on mouse enter with delay', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="hover-card-trigger"]'));
        trigger.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
        fixture.detectChanges();

        // Immediate check - should be closed
        let content = fixture.debugElement.query(By.css('[data-slot="hover-card-content"]'));
        expect(content).toBeNull();

        // Wait for open delay (200ms)
        await new Promise(resolve => setTimeout(resolve, 250));
        fixture.detectChanges();
        await fixture.whenStable();

        content = fixture.debugElement.query(By.css('[data-slot="hover-card-content"]'));
        expect(content).toBeTruthy();
    });

    it('should hide content on mouse leave with delay', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="hover-card-trigger"]'));
        // Open it first
        trigger.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
        await new Promise(resolve => setTimeout(resolve, 250));
        fixture.detectChanges();

        let content = fixture.debugElement.query(By.css('[data-slot="hover-card-content"]'));
        expect(content).toBeTruthy();

        // Mouse leave
        trigger.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));
        fixture.detectChanges();

        // Immediate check - should still be open
        expect(document.querySelector('[data-slot="hover-card-content"]')).toBeTruthy();

        // Wait for close delay (300ms)
        await new Promise(resolve => setTimeout(resolve, 350));
        fixture.detectChanges();
        await fixture.whenStable();

        content = fixture.debugElement.query(By.css('[data-slot="hover-card-content"]'));
        expect(content).toBeNull();
    });

    it('should open on focus', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="hover-card-trigger"]'));
        trigger.nativeElement.dispatchEvent(new FocusEvent('focus'));

        await new Promise(resolve => setTimeout(resolve, 250));
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="hover-card-content"]'));
        expect(content).toBeTruthy();
    });

    it('should stay open when hovering content', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="hover-card-trigger"]'));
        // Open
        trigger.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
        await new Promise(resolve => setTimeout(resolve, 250));
        fixture.detectChanges();

        // Leave trigger (starts close timer)
        trigger.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));

        // Enter content (should cancel close timer)
        const content = fixture.debugElement.query(By.css('[data-slot="hover-card-content"]'));
        content.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));

        // Wait longer than close delay
        await new Promise(resolve => setTimeout(resolve, 350));
        fixture.detectChanges();

        // Should still be open
        expect(document.querySelector('[data-slot="hover-card-content"]')).toBeTruthy();
    });
});
