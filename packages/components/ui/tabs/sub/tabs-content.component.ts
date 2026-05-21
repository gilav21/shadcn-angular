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
  selector: 'ui-tabs-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isActive()) {
      <div
        role="tabpanel"
        [attr.id]="panelId()"
        [attr.aria-labelledby]="triggerId()"
        [attr.tabindex]="0"
        [class]="classes()"
        [attr.data-slot]="'tabs-content'"
      >
        <ng-content />
      </div>
    }
  `,
  host: { '[class]': '"contents"' },
})
export class TabsContentComponent {
  value = input.required<string>();
  class = input('');

  private readonly tabs = inject(TABS, { optional: true });

  isActive = computed(() => this.tabs?.activeTab() === this.value());
  triggerId = computed(() => this.tabs?.getTriggerId(this.value()) ?? '');
  panelId = computed(() => this.tabs?.getPanelId(this.value()) ?? '');

  classes = computed(() =>
    cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      this.class()
    )
  );
}
