import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SkeletonComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SKELETON_DEMO_LOCALES } from './skeleton-demo.locales';

@Component({
  selector: 'app-skeleton-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  template: `
    <section class="space-y-4">
      <h2 id="skeleton" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex items-center gap-4">
        <ui-skeleton class="h-12 w-12 rounded-full" />
        <ui-skeleton class="w-52 h-12 rounded-lg" />
      </div>
      <div class="flex items-center gap-4">
        <ui-skeleton class="w-68 h-12 rounded-lg" />
      </div>
    </section>
  `,
})
export class SkeletonDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(() => SKELETON_DEMO_LOCALES[this.localeId()] ?? SKELETON_DEMO_LOCALES['en']);
}
