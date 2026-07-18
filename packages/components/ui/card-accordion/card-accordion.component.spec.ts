import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CardAccordionComponent,
  CardAccordionItemComponent,
  CardAccordionTriggerComponent,
  CardAccordionActionsComponent,
  CardAccordionContentComponent,
} from './index';

@Component({
  template: `
    <ui-card-accordion [type]="type()" [collapsible]="collapsible()">
      <ui-card-accordion-item value="item-1">
        <ui-card-accordion-trigger>
          Item 1
          <ui-card-accordion-actions>
            <button type="button" data-testid="action-1" (click)="actionClicks.set(actionClicks() + 1)">A</button>
          </ui-card-accordion-actions>
        </ui-card-accordion-trigger>
        <ui-card-accordion-content>Content 1</ui-card-accordion-content>
      </ui-card-accordion-item>
      <ui-card-accordion-item value="item-2">
        <ui-card-accordion-trigger>Item 2</ui-card-accordion-trigger>
        <ui-card-accordion-content>Content 2</ui-card-accordion-content>
      </ui-card-accordion-item>
    </ui-card-accordion>
  `,
  imports: [
    CardAccordionComponent,
    CardAccordionItemComponent,
    CardAccordionTriggerComponent,
    CardAccordionActionsComponent,
    CardAccordionContentComponent,
  ],
})
class TestHostComponent {
  readonly type = signal<'single' | 'multiple'>('single');
  readonly collapsible = signal(true);
  readonly actionClicks = signal(0);
}

describe('CardAccordionComponent', () => {
  let fixture: ComponentFixture<CardAccordionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CardAccordionComponent] }).compileComponents();
    fixture = TestBed.createComponent(CardAccordionComponent);
    fixture.detectChanges();
  });

  it('should create and expose the card-accordion data-slot', () => {
    const root = fixture.debugElement.query(By.css('[data-slot="card-accordion"]'));
    expect(root).toBeTruthy();
  });

  it('should default to single type and apply layout classes', () => {
    expect(fixture.componentInstance.type()).toBe('single');
    const root = fixture.debugElement.query(By.css('[data-slot="card-accordion"]'));
    expect(root.nativeElement.className).toContain('flex');
    expect(root.nativeElement.className).toContain('flex-col');
  });

  it('should toggle open state via the inherited engine', () => {
    const component = fixture.componentInstance;
    component.toggle('item-1');
    expect(component.isOpen('item-1')).toBe(true);
    component.toggle('item-1');
    expect(component.isOpen('item-1')).toBe(false);
  });
});

describe('CardAccordion integration', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const triggers = () => fixture.debugElement.queryAll(By.css('[data-slot="card-accordion-trigger"]'));
  const contents = () => fixture.debugElement.queryAll(By.css('[data-slot="card-accordion-content"]'));

  it('should render all items closed initially', () => {
    const open = triggers().filter((t) => t.nativeElement.getAttribute('aria-expanded') === 'true');
    expect(open).toHaveLength(0);
  });

  it('should open content and rotate the chevron on trigger click', async () => {
    triggers()[0].nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(triggers()[0].nativeElement.getAttribute('aria-expanded')).toBe('true');
    expect(contents()[0].nativeElement.getAttribute('data-state')).toBe('open');
    const chevron = fixture.debugElement.queryAll(By.css('[data-slot="card-accordion-chevron"] svg'))[0];
    expect(chevron.nativeElement.classList.contains('rotate-180')).toBe(true);
  });

  it('should keep closed content in the DOM but inert', () => {
    const inner = contents()[0].nativeElement.querySelector('[inert]');
    expect(inner).toBeTruthy();
  });

  it('should close the previous item in single mode', async () => {
    triggers()[0].nativeElement.click();
    fixture.detectChanges();
    triggers()[1].nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(triggers()[0].nativeElement.getAttribute('aria-expanded')).toBe('false');
    expect(triggers()[1].nativeElement.getAttribute('aria-expanded')).toBe('true');
  });

  it('should allow multiple open panels in multiple mode', async () => {
    host.type.set('multiple');
    fixture.detectChanges();

    triggers()[0].nativeElement.click();
    triggers()[1].nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(triggers()[0].nativeElement.getAttribute('aria-expanded')).toBe('true');
    expect(triggers()[1].nativeElement.getAttribute('aria-expanded')).toBe('true');
  });

  it('should not toggle the panel when a header action is clicked', () => {
    const action = fixture.debugElement.query(By.css('[data-testid="action-1"]'));
    action.nativeElement.click();
    fixture.detectChanges();

    expect(host.actionClicks()).toBe(1);
    expect(triggers()[0].nativeElement.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('CardAccordion simple mode', () => {
  @Component({
    template: `
      <ui-card-accordion>
        <ui-card-accordion-item value="a" title="Title A" description="Sub A" content="Body A" />
      </ui-card-accordion>
    `,
    imports: [CardAccordionComponent, CardAccordionItemComponent],
  })
  class SimpleHostComponent {}

  it('should render title, description and content from inputs', () => {
    TestBed.configureTestingModule({ imports: [SimpleHostComponent] });
    const fixture = TestBed.createComponent(SimpleHostComponent);
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.css('[data-slot="card-accordion-trigger"]'));
    expect(trigger.nativeElement.textContent).toContain('Title A');
    expect(trigger.nativeElement.textContent).toContain('Sub A');
    const content = fixture.debugElement.query(By.css('[data-slot="card-accordion-content"]'));
    expect(content.nativeElement.textContent).toContain('Body A');
  });

  it('should toggle open state via the built-in simple-mode trigger button', async () => {
    TestBed.configureTestingModule({ imports: [SimpleHostComponent] });
    const fixture = TestBed.createComponent(SimpleHostComponent);
    fixture.detectChanges();

    const item = fixture.debugElement.query(By.directive(CardAccordionItemComponent))
      .componentInstance as CardAccordionItemComponent;
    expect(item.isOpen()).toBe(false);

    const button = fixture.debugElement.query(By.css('[data-slot="card-accordion-trigger"]'));
    button.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(item.isOpen()).toBe(true);
    const container = fixture.debugElement.query(By.css('[data-slot="card-accordion-item"]'));
    expect(container.nativeElement.getAttribute('data-state')).toBe('open');
  });
});

describe('CardAccordionItem without a parent accordion', () => {
  @Component({
    template: `<ui-card-accordion-item value="orphan" title="Solo" />`,
    imports: [CardAccordionItemComponent],
  })
  class OrphanItemHostComponent {}

  it('falls back to closed/empty ids and toggling is a no-op', () => {
    TestBed.configureTestingModule({ imports: [OrphanItemHostComponent] });
    const fixture = TestBed.createComponent(OrphanItemHostComponent);
    fixture.detectChanges();

    const item = fixture.debugElement.query(By.directive(CardAccordionItemComponent))
      .componentInstance as CardAccordionItemComponent;

    expect(item.isOpen()).toBe(false);
    expect(item.triggerId()).toBe('');
    expect(item.panelId()).toBe('');

    const button = fixture.debugElement.query(By.css('[data-slot="card-accordion-trigger"]'));
    button.nativeElement.click();
    fixture.detectChanges();

    expect(item.isOpen()).toBe(false);
  });
});

describe('CardAccordionContent fallback branches', () => {
  @Component({
    template: `
      <ui-card-accordion-item value="c1">
        <ui-card-accordion-content>Body</ui-card-accordion-content>
      </ui-card-accordion-item>
    `,
    imports: [CardAccordionItemComponent, CardAccordionContentComponent],
  })
  class ContentItemNoAccordionHostComponent {}

  @Component({
    template: `<ui-card-accordion-content>Loose</ui-card-accordion-content>`,
    imports: [CardAccordionContentComponent],
  })
  class ContentNoItemHostComponent {}

  it('has an item but no accordion: value present, accordion fallbacks fire', () => {
    TestBed.configureTestingModule({ imports: [ContentItemNoAccordionHostComponent] });
    const fixture = TestBed.createComponent(ContentItemNoAccordionHostComponent);
    fixture.detectChanges();

    const content = fixture.debugElement.query(By.directive(CardAccordionContentComponent))
      .componentInstance as CardAccordionContentComponent;

    expect(content.isOpen()).toBe(false);
    expect(content.triggerId()).toBe('');
    expect(content.panelId()).toBe('');
  });

  it('has neither item nor accordion: value-absent fallbacks fire', () => {
    TestBed.configureTestingModule({ imports: [ContentNoItemHostComponent] });
    const fixture = TestBed.createComponent(ContentNoItemHostComponent);
    fixture.detectChanges();

    const content = fixture.debugElement.query(By.directive(CardAccordionContentComponent))
      .componentInstance as CardAccordionContentComponent;

    expect(content.isOpen()).toBe(false);
    expect(content.triggerId()).toBe('');
    expect(content.panelId()).toBe('');
  });
});

describe('CardAccordionContent triggerId with a full accordion', () => {
  @Component({
    template: `
      <ui-card-accordion>
        <ui-card-accordion-item value="full">
          <ui-card-accordion-trigger>Head</ui-card-accordion-trigger>
          <ui-card-accordion-content>Body</ui-card-accordion-content>
        </ui-card-accordion-item>
      </ui-card-accordion>
    `,
    imports: [
      CardAccordionComponent,
      CardAccordionItemComponent,
      CardAccordionTriggerComponent,
      CardAccordionContentComponent,
    ],
  })
  class FullContentHostComponent {}

  it('resolves the real trigger id from the parent accordion', () => {
    TestBed.configureTestingModule({ imports: [FullContentHostComponent] });
    const fixture = TestBed.createComponent(FullContentHostComponent);
    fixture.detectChanges();

    const content = fixture.debugElement.query(By.directive(CardAccordionContentComponent))
      .componentInstance as CardAccordionContentComponent;
    const trigger = fixture.debugElement.query(By.directive(CardAccordionTriggerComponent))
      .componentInstance as CardAccordionTriggerComponent;

    expect(content.triggerId()).not.toBe('');
    expect(content.triggerId()).toBe(trigger.triggerId());
  });
});

describe('CardAccordionTrigger fallback branches', () => {
  @Component({
    template: `
      <ui-card-accordion-item value="t1">
        <ui-card-accordion-trigger>Head</ui-card-accordion-trigger>
      </ui-card-accordion-item>
    `,
    imports: [CardAccordionItemComponent, CardAccordionTriggerComponent],
  })
  class TriggerItemNoAccordionHostComponent {}

  @Component({
    template: `<ui-card-accordion-trigger>Loose</ui-card-accordion-trigger>`,
    imports: [CardAccordionTriggerComponent],
  })
  class TriggerNoItemHostComponent {}

  it('has an item but no accordion: fallbacks fire and toggle is a no-op', () => {
    TestBed.configureTestingModule({ imports: [TriggerItemNoAccordionHostComponent] });
    const fixture = TestBed.createComponent(TriggerItemNoAccordionHostComponent);
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.directive(CardAccordionTriggerComponent))
      .componentInstance as CardAccordionTriggerComponent;

    expect(trigger.isOpen()).toBe(false);
    expect(trigger.triggerId()).toBe('');
    expect(trigger.panelId()).toBe('');

    const button = fixture.debugElement.query(By.css('[data-slot="card-accordion-trigger"]'));
    button.nativeElement.click();
    fixture.detectChanges();
    expect(trigger.isOpen()).toBe(false);
  });

  it('has neither item nor accordion: value-absent fallbacks fire', () => {
    TestBed.configureTestingModule({ imports: [TriggerNoItemHostComponent] });
    const fixture = TestBed.createComponent(TriggerNoItemHostComponent);
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.directive(CardAccordionTriggerComponent))
      .componentInstance as CardAccordionTriggerComponent;

    expect(trigger.isOpen()).toBe(false);
    expect(trigger.triggerId()).toBe('');
    expect(trigger.panelId()).toBe('');

    trigger.toggle();
    expect(trigger.isOpen()).toBe(false);
  });
});
