import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  EmptyComponent,
  EmptyContentComponent,
  EmptyDescriptionComponent,
  EmptyHeaderComponent,
  EmptyMediaComponent,
  EmptyTitleComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { EMPTY_DEMO_LOCALES } from './empty-demo.locales';

@Component({
  selector: 'app-empty-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyComponent,
    EmptyHeaderComponent,
    EmptyMediaComponent,
    EmptyTitleComponent,
    EmptyDescriptionComponent,
    EmptyContentComponent,
    ButtonComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="empty" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="border rounded-lg p-8 max-w-md">
        <ui-empty>
          <ui-empty-header>
            <ui-empty-media>
              <span class="text-4xl">&#x1f4ed;</span>
            </ui-empty-media>
            <ui-empty-title>{{ t().emptyTitle }}</ui-empty-title>
            <ui-empty-description>
              {{ t().emptyDescription }}
            </ui-empty-description>
          </ui-empty-header>
          <ui-empty-content>
            <ui-button>{{ t().buttonLabel }}</ui-button>
          </ui-empty-content>
        </ui-empty>
      </div>
    </section>
  `,
})
export class EmptyDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => EMPTY_DEMO_LOCALES[this.localeId()] ?? EMPTY_DEMO_LOCALES['en']);
}
