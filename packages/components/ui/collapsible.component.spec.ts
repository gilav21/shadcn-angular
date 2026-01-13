import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    CollapsibleComponent,
    CollapsibleTriggerComponent,
    CollapsibleContentComponent
} from './collapsible.component';

@Component({
    template: `
    <ui-collapsible [defaultOpen]="defaultOpen" (openChange)="onOpenChange($event)">
      <ui-collapsible-trigger>Toggle</ui-collapsible-trigger>
      <ui-collapsible-content>Content</ui-collapsible-content>
    </ui-collapsible>
  `,
    imports: [CollapsibleComponent, CollapsibleTriggerComponent, CollapsibleContentComponent]
})
class TestHostComponent {
    defaultOpen = false;
    isOpen = false;

    onOpenChange(val: boolean) {
        this.isOpen = val;
    }
}

describe('CollapsibleComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, CollapsibleComponent]
        }).compileComponents();
    });

    it('should create', () => {
        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should be closed by default', () => {
        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        component.defaultOpen = false;
        fixture.detectChanges();

        const contentHost = fixture.debugElement.query(By.directive(CollapsibleContentComponent));
        // Check if INNER div exists
        const innerDiv = contentHost.query(By.css('[data-slot="collapsible-content"]'));
        expect(innerDiv).toBeFalsy();
    });

    it('should respect defaultOpen=true', () => {
        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        component.defaultOpen = true;
        fixture.detectChanges();

        const contentHost = fixture.debugElement.query(By.directive(CollapsibleContentComponent));
        const innerDiv = contentHost.query(By.css('[data-slot="collapsible-content"]'));
        expect(innerDiv).toBeTruthy();
    });

    it('should toggle content on trigger click', () => {
        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        const trigger = fixture.debugElement.query(By.directive(CollapsibleTriggerComponent));
        const span = trigger.query(By.css('span'));

        // Click to open
        span.nativeElement.click();
        fixture.detectChanges();

        let contentHost = fixture.debugElement.query(By.directive(CollapsibleContentComponent));
        let innerDiv = contentHost.query(By.css('[data-slot="collapsible-content"]'));
        expect(innerDiv).toBeTruthy();
        expect(component.isOpen).toBe(true);

        // Click to close
        span.nativeElement.click();
        fixture.detectChanges();

        contentHost = fixture.debugElement.query(By.directive(CollapsibleContentComponent));
        innerDiv = contentHost.query(By.css('[data-slot="collapsible-content"]'));
        expect(innerDiv).toBeFalsy();
    });

    it('should have correct accessibility attributes', () => {
        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        const collapsible = fixture.debugElement.query(By.directive(CollapsibleComponent));
        const trigger = fixture.debugElement.query(By.directive(CollapsibleTriggerComponent));

        expect(collapsible.attributes['data-state']).toBe('closed');
        expect(trigger.query(By.css('span')).attributes['data-state']).toBe('closed');

        // Open
        trigger.query(By.css('span')).nativeElement.click();
        fixture.detectChanges();

        expect(collapsible.attributes['data-state']).toBe('open');
        expect(trigger.query(By.css('span')).attributes['data-state']).toBe('open');
    });
});
