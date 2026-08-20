import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BannerComponent, ButtonComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { BANNER_DEMO_LOCALES } from './banner-demo.locales';

@Component({
  selector: 'app-banner-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BannerComponent, ButtonComponent],
  template: `
    <section class="space-y-4">
      <h2 id="banner" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-col gap-2 overflow-hidden rounded-lg border">
        <ui-banner variant="info" [message]="t().info" />
        <ui-banner variant="warning" [message]="t().warning" />
        <ui-banner variant="success" [message]="t().success" />
        <ui-banner variant="destructive" [message]="t().destructive" />
      </div>

      <div class="overflow-hidden rounded-lg border">
        <ui-banner variant="warning" [message]="t().dismissible" dismissible (dismissed)="dismissCount.set(dismissCount() + 1)" />
      </div>
      <p class="text-sm text-muted-foreground" data-testid="dismiss-count">{{ dismissCount() }}</p>

      <div class="overflow-hidden rounded-lg border">
        <ui-banner variant="info" dismissible>
          <span class="flex flex-wrap items-center gap-2">
            {{ t().trial }}
            <ui-button size="sm" [label]="t().upgrade" />
          </span>
        </ui-banner>
      </div>
    </section>
  `,
})
export class BannerDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => BANNER_DEMO_LOCALES[this.localeId()] ?? BANNER_DEMO_LOCALES['en']);
  protected readonly dismissCount = signal(0);
}
