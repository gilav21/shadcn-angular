import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccordionComponent, AccordionItemComponent, AccordionTriggerComponent, AccordionContentComponent, ACCORDION } from './accordion.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host component for integration tests
@Component({
    template: `
        <ui-accordion [type]="type()">
            <ui-accordion-item value="item-1">
                <ui-accordion-trigger>Item 1</ui-accordion-trigger>
                <ui-accordion-content>Content 1</ui-accordion-content>
            </ui-accordion-item>
            <ui-accordion-item value="item-2">
                <ui-accordion-trigger>Item 2</ui-accordion-trigger>
                <ui-accordion-content>Content 2</ui-accordion-content>
            </ui-accordion-item>
            <ui-accordion-item value="item-3">
                <ui-accordion-trigger>Item 3</ui-accordion-trigger>
                <ui-accordion-content>Content 3</ui-accordion-content>
            </ui-accordion-item>
        </ui-accordion>
    `,
    imports: [AccordionComponent, AccordionItemComponent, AccordionTriggerComponent, AccordionContentComponent]
})
class TestHostComponent {
    type = signal<'single' | 'multiple'>('single');
}

// RTL Test host component
@Component({
    template: `
        <div [dir]="dir()">
            <ui-accordion>
                <ui-accordion-item value="item-1">
                    <ui-accordion-trigger>العنصر الأول</ui-accordion-trigger>
                    <ui-accordion-content>المحتوى الأول</ui-accordion-content>
                </ui-accordion-item>
                <ui-accordion-item value="item-2">
                    <ui-accordion-trigger>العنصر الثاني</ui-accordion-trigger>
                    <ui-accordion-content>المحتوى الثاني</ui-accordion-content>
                </ui-accordion-item>
            </ui-accordion>
        </div>
    `,
    imports: [AccordionComponent, AccordionItemComponent, AccordionTriggerComponent, AccordionContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('AccordionComponent', () => {
    let component: AccordionComponent;
    let fixture: ComponentFixture<AccordionComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AccordionComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AccordionComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="accordion"', () => {
        const div = fixture.debugElement.query(By.css('[data-slot="accordion"]'));
        expect(div).toBeTruthy();
    });

    it('should have default type="single"', () => {
        expect(component.type()).toBe('single');
    });

    it('should apply w-full class', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.className).toContain('w-full');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-accordion');
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.className).toContain('my-accordion');
    });

    it('should toggle single item correctly', () => {
        component.toggle('item-1');
        expect(component.isOpen('item-1')).toBe(true);
        expect(component.isOpen('item-2')).toBe(false);

        // Toggle same item closes it
        component.toggle('item-1');
        expect(component.isOpen('item-1')).toBe(false);
    });

    it('should close previous item in single mode', () => {
        component.toggle('item-1');
        expect(component.isOpen('item-1')).toBe(true);

        component.toggle('item-2');
        expect(component.isOpen('item-1')).toBe(false);
        expect(component.isOpen('item-2')).toBe(true);
    });

    it('should allow multiple items in multiple mode', () => {
        fixture.componentRef.setInput('type', 'multiple');
        fixture.detectChanges();

        component.toggle('item-1');
        component.toggle('item-2');

        expect(component.isOpen('item-1')).toBe(true);
        expect(component.isOpen('item-2')).toBe(true);
    });
});

describe('AccordionItemComponent', () => {
    let component: AccordionItemComponent;
    let fixture: ComponentFixture<AccordionItemComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AccordionItemComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AccordionItemComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('value', 'test-item');
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="accordion-item"', () => {
        const div = fixture.debugElement.query(By.css('[data-slot="accordion-item"]'));
        expect(div).toBeTruthy();
    });

    it('should have border-b class', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.className).toContain('border-b');
    });

    it('should have required value input', () => {
        expect(component.value()).toBe('test-item');
    });
});

describe('Accordion Integration', () => {
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

    it('should render accordion with items', () => {
        const accordion = fixture.debugElement.query(By.directive(AccordionComponent));
        const items = fixture.debugElement.queryAll(By.directive(AccordionItemComponent));
        const triggers = fixture.debugElement.queryAll(By.directive(AccordionTriggerComponent));

        expect(accordion).toBeTruthy();
        expect(items.length).toBe(3);
        expect(triggers.length).toBe(3);
    });

    it('should not show content initially', () => {
        const contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents.length).toBe(0);
    });

    it('should open content on trigger click', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));
        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents.length).toBe(1);
        expect(contents[0].nativeElement.textContent).toContain('Content 1');
    });

    it('should have aria-expanded attribute on trigger', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));
        expect(triggers[0].nativeElement.getAttribute('aria-expanded')).toBe('false');
    });

    it('should update aria-expanded when opened', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));
        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(triggers[0].nativeElement.getAttribute('aria-expanded')).toBe('true');
    });

    it('should have data-state attribute', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));
        expect(triggers[0].nativeElement.getAttribute('data-state')).toBe('closed');

        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(triggers[0].nativeElement.getAttribute('data-state')).toBe('open');
    });

    it('should close previous item in single mode', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));

        // Open first item
        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        let contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents.length).toBe(1);

        // Open second item (should close first)
        triggers[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents.length).toBe(1);
        expect(contents[0].nativeElement.textContent).toContain('Content 2');
    });

    it('should allow multiple open items in multiple mode', async () => {
        component.type.set('multiple');
        fixture.detectChanges();
        await fixture.whenStable();

        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));

        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        triggers[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents.length).toBe(2);
    });
});

describe('Accordion RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    it('should render correctly in LTR mode', () => {
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();

        const accordion = fixture.debugElement.query(By.directive(AccordionComponent));
        expect(accordion).toBeTruthy();
    });

    it('should render correctly in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
        expect(container.nativeElement.getAttribute('dir')).toBe('rtl');
    });

    it('should maintain trigger functionality in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));
        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents.length).toBe(1);
    });

    it('should have flex layout with justify-between for RTL chevron positioning', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));
        const triggerClasses = triggers[0].nativeElement.className;

        // Flex layout ensures chevron is on opposite side in RTL
        expect(triggerClasses).toContain('flex');
        expect(triggerClasses).toContain('justify-between');
    });

    it('should preserve DOM order in RTL (CSS handles visual reversal)', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.directive(AccordionItemComponent));

        // First DOM item should still be item-1
        expect(items[0].componentInstance.value()).toBe('item-1');
        expect(items[1].componentInstance.value()).toBe('item-2');
    });
});
