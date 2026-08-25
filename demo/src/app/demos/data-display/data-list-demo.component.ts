import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  BadgeComponent,
  ButtonComponent,
  DataListComponent,
  DataListItemComponent,
  type DataListItem,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { DATA_LIST_DEMO_LOCALES } from './data-list-demo.locales';

@Component({
  selector: 'app-data-list-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataListComponent, DataListItemComponent, BadgeComponent, ButtonComponent],
  template: `
    <section class="space-y-6">
      <h2 id="data-list" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-2">
        <p class="text-sm text-muted-foreground">{{ t().verticalLabel }}</p>
        <div class="rounded-lg border p-4 sm:p-6">
          <ui-data-list [items]="items()" />
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-sm text-muted-foreground">{{ t().horizontalLabel }}</p>
        <div class="rounded-lg border p-4 sm:p-6">
          <ui-data-list [items]="items()" orientation="horizontal" />
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-sm text-muted-foreground">{{ t().customLabel }}</p>
        <div class="rounded-lg border p-4 sm:p-6">
          <ui-data-list orientation="horizontal">
            <ui-data-list-item [label]="t().labelStatus">
              <ui-badge [label]="t().valueActive" />
            </ui-data-list-item>
            <ui-data-list-item [label]="t().labelOwner">{{ t().valueOwner }}</ui-data-list-item>
            <ui-data-list-item [label]="t().labelApiKey">
              <span class="flex flex-wrap items-center gap-2">
                <code class="rounded bg-muted px-1.5 py-0.5 text-xs">sk_live_5f2b&hellip;</code>
                <ui-button size="sm" variant="outline" [label]="t().rotate" />
              </span>
            </ui-data-list-item>
          </ui-data-list>
        </div>
      </div>
    </section>
  `,
})
export class DataListDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => DATA_LIST_DEMO_LOCALES[this.localeId()] ?? DATA_LIST_DEMO_LOCALES['en']
  );

  protected readonly items = computed<DataListItem[]>(() => [
    { label: this.t().labelStatus, value: this.t().valueActive },
    { label: this.t().labelPlan, value: this.t().valueEnterprise },
    { label: this.t().labelSeats, value: this.t().valueSeats },
  ]);
}
