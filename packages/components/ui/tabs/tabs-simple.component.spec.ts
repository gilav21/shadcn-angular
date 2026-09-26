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
import { TabsListComponent } from './sub/tabs-list.component';
import { TabsTriggerComponent } from './sub/tabs-trigger.component';
import { TabsContentComponent } from './sub/tabs-content.component';

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

});

@Component({
  template: `
    @for (set of ['first', 'second']; track set) {
      <ui-tabs defaultValue="account">
        <ui-tabs-list>
          <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
          <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
        </ui-tabs-list>
        <ui-tabs-content value="account">Account settings</ui-tabs-content>
        <ui-tabs-content value="password">Password settings</ui-tabs-content>
      </ui-tabs>
    }
  `,
  imports: [TabsComponent, TabsListComponent, TabsTriggerComponent, TabsContentComponent],
})
class TwoTabSetsHostComponent {}

describe('TabsComponent template mode trigger/panel linking', () => {
  it('links each trigger and panel by id, uniquely per tab set', async () => {
    await TestBed.configureTestingModule({ imports: [TwoTabSetsHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwoTabSetsHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const sets = Array.from(root.querySelectorAll('ui-tabs')).map(set => {
      const trigger = Array.from(set.querySelectorAll<HTMLElement>('[role="tab"]'))
        .find(t => t.textContent?.trim() === 'Account')!;
      const panel = set.querySelector<HTMLElement>('[role="tabpanel"]')!;
      expect(panel.textContent?.trim()).toBe('Account settings');
      expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);
      return { trigger: trigger.id, panel: panel.id };
    });

    expect(sets).toHaveLength(2);
    expect(sets[0].trigger).not.toBe(sets[1].trigger);
    expect(sets[0].panel).not.toBe(sets[1].panel);
    expect(root.querySelectorAll(`[id="${sets[0].trigger}"]`)).toHaveLength(1);
  });
});
