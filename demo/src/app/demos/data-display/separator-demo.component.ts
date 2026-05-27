import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SeparatorComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SEPARATOR_DEMO_LOCALES } from './separator-demo.locales';

@Component({
  selector: 'app-separator-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SeparatorComponent],
  template: `
    <section class="space-y-4">
      <h2 id="separator" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-4">
        <div>
          <h4 class="text-sm font-medium leading-none">{{ t().libraryName }}</h4>
          <p class="text-sm text-muted-foreground">
            {{ t().libraryDescription }}
          </p>
        </div>
        <ui-separator class="my-4" />
        <div class="flex h-5 items-center space-x-4 text-sm">
          <div>{{ t().navBlog }}</div>
          <ui-separator orientation="vertical" />
          <div>{{ t().navDocs }}</div>
          <ui-separator orientation="vertical" />
          <div>{{ t().navSource }}</div>
        </div>
      </div>
    </section>
  `,
})
export class SeparatorDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(() => SEPARATOR_DEMO_LOCALES[this.localeId()] ?? SEPARATOR_DEMO_LOCALES['en']);
}
