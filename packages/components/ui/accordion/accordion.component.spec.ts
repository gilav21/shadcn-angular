import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccordionComponent, AccordionItemComponent, AccordionTriggerComponent, AccordionContentComponent, ACCORDION_ITEM } from './index';
import { Component, signal, inject } from '@angular/core';
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

    it('should keep the active item open when collapsible is false', () => {
        fixture.componentRef.setInput('collapsible', false);
        fixture.detectChanges();

        component.toggle('item-1');
        expect(component.isOpen('item-1')).toBe(true);

        // Re-clicking the open item does not close it
        component.toggle('item-1');
        expect(component.isOpen('item-1')).toBe(true);
    });

    it('should still switch items when collapsible is false', () => {
        fixture.componentRef.setInput('collapsible', false);
        fixture.detectChanges();

        component.toggle('item-1');
        component.toggle('item-2');

        expect(component.isOpen('item-1')).toBe(false);
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

    it('should render skeletons instead of the trigger when skeleton is true', () => {
        fixture.componentRef.setInput('skeleton', true);
        fixture.componentRef.setInput('title', 'Item title');
        fixture.detectChanges();
        expect(fixture.debugElement.queryAll(By.css('ui-skeleton'))).toHaveLength(2);
        expect(fixture.debugElement.query(By.css('button'))).toBeNull();
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
        expect(items).toHaveLength(3);
        expect(triggers).toHaveLength(3);
    });

    it('should not show content initially', () => {
        const contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents).toHaveLength(0);
    });

    it('should open content on trigger click', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));
        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents).toHaveLength(1);
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
        expect(triggers[0].nativeElement.dataset.state).toBe('closed');

        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(triggers[0].nativeElement.dataset.state).toBe('open');
    });

    it('should close previous item in single mode', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));

        // Open first item
        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        let contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents).toHaveLength(1);

        // Open second item (should close first)
        triggers[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents).toHaveLength(1);
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
        expect(contents).toHaveLength(2);
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
        expect(contents).toHaveLength(1);
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

// Test host for simple mode (data-driven)
@Component({
    template: `
        <ui-accordion [type]="type()">
            <ui-accordion-item value="item-1" title="First Question" content="First answer content" />
            <ui-accordion-item value="item-2" title="Second Question" content="Second answer content" />
            <ui-accordion-item value="item-3" title="Third Question" content="Third answer content" />
        </ui-accordion>
    `,
    imports: [AccordionComponent, AccordionItemComponent]
})
class SimpleModeTestHostComponent {
    type = signal<'single' | 'multiple'>('single');
}

describe('Accordion Simple Mode (Data-Driven)', () => {
    let fixture: ComponentFixture<SimpleModeTestHostComponent>;
    let component: SimpleModeTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SimpleModeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SimpleModeTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render all items', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="accordion-item"]'));
        expect(items).toHaveLength(3);
    });

    it('should render triggers with title text', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));
        expect(triggers).toHaveLength(3);
        expect(triggers[0].nativeElement.textContent).toContain('First Question');
        expect(triggers[1].nativeElement.textContent).toContain('Second Question');
        expect(triggers[2].nativeElement.textContent).toContain('Third Question');
    });

    it('should not show content initially', () => {
        const contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents).toHaveLength(0);
    });

    it('should show content on trigger click', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));
        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents).toHaveLength(1);
        expect(contents[0].nativeElement.textContent).toContain('First answer content');
    });

    it('should have aria-expanded on triggers', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));
        expect(triggers[0].nativeElement.getAttribute('aria-expanded')).toBe('false');
    });

    it('should update aria-expanded when opened', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));
        triggers[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(triggers[1].nativeElement.getAttribute('aria-expanded')).toBe('true');
    });

    it('should close previous item in single mode', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));

        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        triggers[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents).toHaveLength(1);
        expect(contents[0].nativeElement.textContent).toContain('Second answer content');
    });

    it('should allow multiple open items in multiple mode', async () => {
        component.type.set('multiple');
        fixture.detectChanges();

        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="accordion-trigger"]'));

        triggers[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        triggers[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const contents = fixture.debugElement.queryAll(By.css('[data-slot="accordion-content"]'));
        expect(contents).toHaveLength(2);
    });
});

// Probe that injects the ACCORDION_ITEM token to exercise the item's provider
@Component({ selector: 'item-token-probe', template: '' })
class ItemTokenProbeComponent {
    readonly item = inject(ACCORDION_ITEM);
}

@Component({
    template: `
        <ui-accordion-item value="probe-item">
            <item-token-probe />
        </ui-accordion-item>
    `,
    imports: [AccordionItemComponent, ItemTokenProbeComponent]
})
class ItemTokenHostComponent {}

describe('AccordionItemComponent ACCORDION_ITEM provider', () => {
    it('exposes itself through the ACCORDION_ITEM token', () => {
        TestBed.configureTestingModule({ imports: [ItemTokenHostComponent] });
        const fixture = TestBed.createComponent(ItemTokenHostComponent);
        fixture.detectChanges();

        const probe = fixture.debugElement.query(By.directive(ItemTokenProbeComponent))
            .componentInstance as ItemTokenProbeComponent;
        expect(probe.item).toBeInstanceOf(AccordionItemComponent);
        expect(probe.item.value()).toBe('probe-item');
    });
});

// Item rendered in simple mode with NO parent accordion => optional inject is null
describe('AccordionItemComponent without a parent accordion', () => {
    let component: AccordionItemComponent;
    let fixture: ComponentFixture<AccordionItemComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AccordionItemComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AccordionItemComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('value', 'lonely');
        fixture.componentRef.setInput('title', 'Lonely Item');
        fixture.detectChanges();
    });

    it('falls back to closed / empty ids when no accordion is present', () => {
        expect(component.isOpen()).toBe(false);
        expect(component.triggerId()).toBe('');
        expect(component.panelId()).toBe('');
    });

    it('renders the simple-mode trigger and toggles without a parent accordion', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('aria-expanded')).toBe('false');

        // toggle() short-circuits on the optional (null) accordion without throwing
        expect(() => button.nativeElement.click()).not.toThrow();
        fixture.detectChanges();
        expect(component.isOpen()).toBe(false);
    });
});

// Trigger rendered standalone (no item, no accordion) => value() is undefined
describe('AccordionTriggerComponent without item/accordion', () => {
    let component: AccordionTriggerComponent;
    let fixture: ComponentFixture<AccordionTriggerComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AccordionTriggerComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AccordionTriggerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('returns closed state and empty ids with no item value', () => {
        expect(component.isOpen()).toBe(false);
        expect(component.triggerId()).toBe('');
        expect(component.panelId()).toBe('');
    });

    it('does nothing when toggled with no value', () => {
        expect(() => component.toggle()).not.toThrow();
        expect(component.isOpen()).toBe(false);
    });
});

// Trigger inside an item but WITHOUT an accordion => value() truthy, accordion null
@Component({
    template: `
        <ui-accordion-item value="orphan">
            <ui-accordion-trigger>Orphan trigger</ui-accordion-trigger>
        </ui-accordion-item>
    `,
    imports: [AccordionItemComponent, AccordionTriggerComponent]
})
class OrphanTriggerHostComponent {}

describe('AccordionTriggerComponent in item without accordion', () => {
    let fixture: ComponentFixture<OrphanTriggerHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [OrphanTriggerHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(OrphanTriggerHostComponent);
        fixture.detectChanges();
    });

    it('nullish-coalesces the missing accordion to closed / empty', () => {
        const trigger = fixture.debugElement.query(By.directive(AccordionTriggerComponent))
            .componentInstance as AccordionTriggerComponent;
        expect(trigger.isOpen()).toBe(false);
        expect(trigger.triggerId()).toBe('');
        expect(trigger.panelId()).toBe('');
    });

    it('toggle() is a no-op when the accordion is missing', () => {
        const trigger = fixture.debugElement.query(By.directive(AccordionTriggerComponent))
            .componentInstance as AccordionTriggerComponent;
        expect(() => trigger.toggle()).not.toThrow();
        expect(trigger.isOpen()).toBe(false);
    });
});

// Content rendered standalone (no item, no accordion) => value() is undefined
describe('AccordionContentComponent without item/accordion', () => {
    let component: AccordionContentComponent;
    let fixture: ComponentFixture<AccordionContentComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AccordionContentComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AccordionContentComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('stays closed and exposes empty ids with no item value', () => {
        expect(component.isOpen()).toBe(false);
        expect(component.triggerId()).toBe('');
        expect(component.panelId()).toBe('');
    });

    it('does not render its panel when closed', () => {
        expect(fixture.debugElement.query(By.css('[data-slot="accordion-content"]'))).toBeNull();
    });
});

// Content inside an item but WITHOUT an accordion => value() truthy, accordion null
@Component({
    template: `
        <ui-accordion-item value="orphan-content">
            <ui-accordion-content>Orphan content</ui-accordion-content>
        </ui-accordion-item>
    `,
    imports: [AccordionItemComponent, AccordionContentComponent]
})
class OrphanContentHostComponent {}

describe('AccordionContentComponent in item without accordion', () => {
    let fixture: ComponentFixture<OrphanContentHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [OrphanContentHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(OrphanContentHostComponent);
        fixture.detectChanges();
    });

    it('nullish-coalesces the missing accordion to closed / empty', () => {
        const content = fixture.debugElement.query(By.directive(AccordionContentComponent))
            .componentInstance as AccordionContentComponent;
        expect(content.isOpen()).toBe(false);
        expect(content.triggerId()).toBe('');
        expect(content.panelId()).toBe('');
    });
});

// Controlled `openValues` input drives the sync effect
describe('AccordionComponent openValues effect', () => {
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

    it('opens the first value in single mode when openValues has entries', () => {
        fixture.componentRef.setInput('openValues', ['item-2', 'item-3']);
        fixture.detectChanges();

        // single mode keeps only the first entry
        expect(component.isOpen('item-2')).toBe(true);
        expect(component.isOpen('item-3')).toBe(false);
    });

    it('clears open items in single mode when openValues is an empty array', () => {
        fixture.componentRef.setInput('openValues', ['item-1']);
        fixture.detectChanges();
        expect(component.isOpen('item-1')).toBe(true);

        fixture.componentRef.setInput('openValues', []);
        fixture.detectChanges();
        expect(component.isOpen('item-1')).toBe(false);
        expect(component.openItems().size).toBe(0);
    });

    it('opens every value in multiple mode', () => {
        fixture.componentRef.setInput('type', 'multiple');
        fixture.componentRef.setInput('openValues', ['item-1', 'item-3']);
        fixture.detectChanges();

        expect(component.isOpen('item-1')).toBe(true);
        expect(component.isOpen('item-3')).toBe(true);
        expect(component.isOpen('item-2')).toBe(false);
    });

    it('collapses an open item in multiple mode when toggled again', () => {
        fixture.componentRef.setInput('type', 'multiple');
        fixture.detectChanges();

        component.toggle('item-1');
        component.toggle('item-2');
        expect(component.isOpen('item-1')).toBe(true);
        expect(component.isOpen('item-2')).toBe(true);

        // toggling an already-open item deletes it from the set
        component.toggle('item-1');
        expect(component.isOpen('item-1')).toBe(false);
        expect(component.isOpen('item-2')).toBe(true);
    });
});
