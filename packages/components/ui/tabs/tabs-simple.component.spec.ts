import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  Component,
  TemplateRef,
  ViewChild,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { TabsComponent, TabConfig } from './tabs.component';

@Component({
  selector: 'ui-tab-outlet-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="outlet-marker">Hello {{ name() }}</span>`,
})
class OutletContentComponent {
  name = input('');
}

@Component({
  template: `
    <ng-template #tpl let-msg="msg">
      <span class="template-marker">{{ msg }}</span>
    </ng-template>
    <ui-tabs
      [defaultValue]="defaultValue"
      [tabs]="tabs"
      (tabChange)="lastChange = $event"
    />
  `,
  imports: [TabsComponent],
})
class SimpleHostComponent {
  @ViewChild('tpl', { static: true }) tpl!: TemplateRef<unknown>;
  defaultValue = '';
  tabs: TabConfig[] = [];
  lastChange = '';
}

describe('TabsComponent simple mode (tabs input)', () => {
  let fixture: ComponentFixture<SimpleHostComponent>;
  let host: SimpleHostComponent;

  const build = (tabs: TabConfig[], defaultValue = '') => {
    host.tabs = tabs;
    host.defaultValue = defaultValue;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimpleHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SimpleHostComponent);
    host = fixture.componentInstance;
  });

  it('auto-generates a button per tab config', () => {
    build([
      { value: 'a', label: 'Alpha', content: 'Content A' },
      { value: 'b', label: 'Beta', content: 'Content B' },
    ]);
    const buttons = fixture.debugElement.queryAll(By.css('button[role="tab"]'));
    expect(buttons).toHaveLength(2);
    expect(buttons[0].nativeElement.textContent).toContain('Alpha');
  });

  it('defaults active tab to the first tab when no defaultValue (ngOnInit else-if)', () => {
    build([
      { value: 'a', label: 'Alpha', content: 'Content A' },
      { value: 'b', label: 'Beta', content: 'Content B' },
    ]);
    const tabs = fixture.debugElement.query(By.directive(TabsComponent))
      .componentInstance as TabsComponent;
    expect(tabs.activeTab()).toBe('a');
    const panel = fixture.debugElement.query(By.css('[role="tabpanel"]'));
    expect(panel.nativeElement.textContent).toContain('Content A');
  });

  it('honors defaultValue over first tab', () => {
    build(
      [
        { value: 'a', label: 'Alpha', content: 'Content A' },
        { value: 'b', label: 'Beta', content: 'Content B' },
      ],
      'b'
    );
    const panel = fixture.debugElement.query(By.css('[role="tabpanel"]'));
    expect(panel.nativeElement.textContent).toContain('Content B');
  });

  it('applies active vs inactive trigger classes (triggerClasses both branches)', () => {
    build([
      { value: 'a', label: 'Alpha', content: 'A' },
      { value: 'b', label: 'Beta', content: 'B' },
    ]);
    const buttons = fixture.debugElement.queryAll(By.css('button[role="tab"]'));
    expect(buttons[0].nativeElement.className).toContain('bg-background');
    expect(buttons[0].nativeElement.className).toContain('text-foreground');
    expect(buttons[1].nativeElement.className).toContain('hover:bg-background/50');
  });

  it('selects a tab on click, updates state and emits tabChange', () => {
    build([
      { value: 'a', label: 'Alpha', content: 'Content A' },
      { value: 'b', label: 'Beta', content: 'Content B' },
    ]);
    const buttons = fixture.debugElement.queryAll(By.css('button[role="tab"]'));
    buttons[1].nativeElement.click();
    fixture.detectChanges();

    expect(host.lastChange).toBe('b');
    expect(buttons[1].nativeElement.getAttribute('aria-selected')).toBe('true');
    expect(buttons[1].nativeElement.dataset.state).toBe('active');
    expect(buttons[1].nativeElement.getAttribute('tabindex')).toBe('0');
    expect(buttons[0].nativeElement.getAttribute('tabindex')).toBe('-1');
    const panel = fixture.debugElement.query(By.css('[role="tabpanel"]'));
    expect(panel.nativeElement.textContent).toContain('Content B');
  });

  it('respects disabled tab config', () => {
    build([
      { value: 'a', label: 'Alpha', content: 'A' },
      { value: 'b', label: 'Beta', content: 'B', disabled: true },
    ]);
    const buttons = fixture.debugElement.queryAll(By.css('button[role="tab"]'));
    expect(buttons[1].nativeElement.disabled).toBe(true);
  });

  it('renders string content directly (isString true)', () => {
    build([{ value: 'a', label: 'Alpha', content: 'plain string content' }]);
    const panel = fixture.debugElement.query(By.css('[role="tabpanel"]'));
    expect(panel.nativeElement.textContent).toContain('plain string content');
  });

  it('renders TemplateRef content via ngTemplateOutlet (isTemplateRef true)', () => {
    host.tabs = [
      {
        value: 'a',
        label: 'Alpha',
        content: host.tpl,
        contentContext: { msg: 'from template' },
      },
    ];
    host.defaultValue = 'a';
    fixture.detectChanges();
    const marker = fixture.debugElement.query(By.css('.template-marker'));
    expect(marker).toBeTruthy();
    expect(marker.nativeElement.textContent).toContain('from template');
  });

  it('renders component Type content via ngComponentOutlet (isString/isTemplateRef false)', () => {
    build([
      {
        value: 'a',
        label: 'Alpha',
        content: OutletContentComponent,
        contentContext: { name: 'World' },
      },
    ]);
    const marker = fixture.debugElement.query(By.css('.outlet-marker'));
    expect(marker).toBeTruthy();
    expect(marker.nativeElement.textContent).toContain('Hello World');
  });

  it('renders no panel when the active tab has no content', () => {
    build([{ value: 'a', label: 'Alpha' }]);
    expect(fixture.debugElement.query(By.css('[role="tabpanel"]'))).toBeNull();
  });

  it('isString / isTemplateRef helpers classify content types', () => {
    build([{ value: 'a', label: 'Alpha', content: 'x' }]);
    const tabs = fixture.debugElement.query(By.directive(TabsComponent))
      .componentInstance as TabsComponent;
    expect(tabs.isString('hello')).toBe(true);
    expect(tabs.isString(123)).toBe(false);
    expect(tabs.isTemplateRef(host.tpl)).toBe(true);
    expect(tabs.isTemplateRef('nope')).toBe(false);
  });

  it('exposes stable trigger/panel id helpers', () => {
    build([{ value: 'a', label: 'Alpha', content: 'A' }]);
    const tabs = fixture.debugElement.query(By.directive(TabsComponent))
      .componentInstance as TabsComponent;
    expect(tabs.getTriggerId('a')).toBe(`${tabs.tabsId}-trigger-a`);
    expect(tabs.getPanelId('a')).toBe(`${tabs.tabsId}-panel-a`);
  });
});
