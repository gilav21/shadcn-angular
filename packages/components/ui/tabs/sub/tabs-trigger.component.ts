import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { TABS } from '../tabs.component';

@Component({
  selector: 'ui-tabs-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tabs-trigger.component.css',
  template: `
    <button
      type="button"
      role="tab"
      [attr.id]="triggerId()"
      [attr.aria-selected]="isActive()"
      [attr.aria-controls]="panelId()"
      [attr.data-state]="isActive() ? 'active' : 'inactive'"
      [attr.tabindex]="isActive() ? 0 : -1"
      [class]="classes()"
      [attr.data-slot]="'tabs-trigger'"
      (click)="select()"
    >
      <ng-content />
    </button>
  `,
  host: { '[class]': '"contents"' },
})
export class TabsTriggerComponent {
  value = input.required<string>();
  class = input('');

  private readonly tabs = inject(TABS, { optional: true });

  readonly isActive = computed(() => this.tabs?.activeTab() === this.value());
  readonly triggerId = computed(() => this.tabs?.getTriggerId(this.value()) ?? '');
  readonly panelId = computed(() => this.tabs?.getPanelId(this.value()) ?? '');

  readonly classes = computed(() =>
    cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      this.isActive()
        ? 'bg-background text-foreground shadow'
        : 'hover:bg-background/50',
      this.class()
    )
  );

  select(): void {
    if (this.tabs) {
      this.tabs.selectTab(this.value());
    }
  }
}
