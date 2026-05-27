import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BadgeComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { BADGE_DEMO_LOCALES } from './badge-demo.locales';

@Component({
  selector: 'app-badge-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <section class="space-y-4">
      <h2 id="badge" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-wrap gap-2">
        <ui-badge>{{ t().labelDefault }}</ui-badge>
        <ui-badge variant="secondary">{{ t().labelSecondary }}</ui-badge>
        <ui-badge variant="outline">{{ t().labelOutline }}</ui-badge>
        <ui-badge variant="destructive">{{ t().labelDestructive }}</ui-badge>
      </div>
    </section>
  `,
})
export class BadgeDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => BADGE_DEMO_LOCALES[this.localeId()] ?? BADGE_DEMO_LOCALES['en']);
}
