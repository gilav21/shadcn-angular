import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    CollapsibleComponent,
    CollapsibleTriggerComponent,
    CollapsibleContentComponent
} from './index';

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

@Component({
    template: `
    <ui-collapsible [disabled]="disabled" [class]="cls" (openChange)="onOpenChange($event)">
      <ui-collapsible-trigger>Toggle</ui-collapsible-trigger>
      <ui-collapsible-content [class]="contentCls">Content</ui-collapsible-content>
    </ui-collapsible>
  `,
    imports: [CollapsibleComponent, CollapsibleTriggerComponent, CollapsibleContentComponent]
})
class ApiHostComponent {
    disabled = false;
    cls = '';
    contentCls = '';
    changes: boolean[] = [];

    onOpenChange(val: boolean) {
        this.changes.push(val);
    }
}

describe('CollapsibleComponent API', () => {
    let fixture: ComponentFixture<ApiHostComponent>;
    let host: ApiHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ApiHostComponent]
        }).compileComponents();
    });

    function configure(setInputs?: (h: ApiHostComponent) => void): CollapsibleComponent {
        fixture = TestBed.createComponent(ApiHostComponent);
        host = fixture.componentInstance;
        setInputs?.(host);
        fixture.detectChanges();
        return fixture.debugElement.query(By.directive(CollapsibleComponent)).componentInstance;
    }

    it('show() opens and emits true', () => {
        const collapsible = configure();
        collapsible.show();
        fixture.detectChanges();
        expect(collapsible.open()).toBe(true);
        expect(host.changes).toEqual([true]);
    });

    it('hide() closes and emits false after being shown', () => {
        const collapsible = configure();
        collapsible.show();
        collapsible.hide();
        fixture.detectChanges();
        expect(collapsible.open()).toBe(false);
        expect(host.changes).toEqual([true, false]);
    });

    it('hide() works while disabled (no disabled guard)', () => {
        const collapsible = configure(h => { h.disabled = true; });
        collapsible.hide();
        fixture.detectChanges();
        expect(collapsible.open()).toBe(false);
        expect(host.changes).toEqual([false]);
    });

    it('toggle() is a no-op when disabled', () => {
        const collapsible = configure(h => { h.disabled = true; });
        collapsible.toggle();
        fixture.detectChanges();
        expect(collapsible.open()).toBe(false);
        expect(host.changes).toEqual([]);
    });

    it('show() is a no-op when disabled', () => {
        const collapsible = configure(h => { h.disabled = true; });
        collapsible.show();
        fixture.detectChanges();
        expect(collapsible.open()).toBe(false);
        expect(host.changes).toEqual([]);
    });

    it('toggle() flips open state and emits both transitions', () => {
        const collapsible = configure();
        collapsible.toggle();
        fixture.detectChanges();
        expect(collapsible.open()).toBe(true);

        collapsible.toggle();
        fixture.detectChanges();
        expect(collapsible.open()).toBe(false);
        expect(host.changes).toEqual([true, false]);
    });

    it('merges the class input into host classes', () => {
        const collapsible = configure(h => { h.cls = 'my-custom-class'; });
        expect(collapsible.classes()).toContain('my-custom-class');
    });

    it('projects a custom class onto the content when open', () => {
        const collapsible = configure(h => { h.contentCls = 'content-extra'; });
        collapsible.show();
        fixture.detectChanges();
        const inner = fixture.debugElement
            .query(By.directive(CollapsibleContentComponent))
            .query(By.css('[data-slot="collapsible-content"]'));
        expect(inner).toBeTruthy();
        expect(inner.nativeElement.className).toContain('content-extra');
        expect(inner.nativeElement.className).toContain('overflow-hidden');
    });
});
