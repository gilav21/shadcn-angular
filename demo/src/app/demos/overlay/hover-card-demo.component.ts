import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  AvatarComponent,
  AvatarFallbackComponent,
  AvatarImageComponent,
  ButtonComponent,
  HoverCardComponent,
  HoverCardContentComponent,
  HoverCardTriggerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { HOVER_CARD_DEMO_LOCALES } from './hover-card-demo.locales';

@Component({
  selector: 'app-hover-card-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    AvatarFallbackComponent,
    AvatarImageComponent,
    ButtonComponent,
    HoverCardComponent,
    HoverCardContentComponent,
    HoverCardTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="hover-card" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-hover-card>
        <ui-hover-card-trigger>
          <ui-button variant="link">{{ t().handle }}</ui-button>
        </ui-hover-card-trigger>
        <ui-hover-card-content>
          <div class="flex justify-between space-x-4">
            <ui-avatar>
              <ui-avatar-image src="https://github.com/angular.png" />
              <ui-avatar-fallback>NG</ui-avatar-fallback>
            </ui-avatar>
            <div class="space-y-1">
              <h4 class="text-sm font-semibold">{{ t().handle }}</h4>
              <p class="text-sm">{{ t().tagline }}</p>
              <div class="flex items-center pt-2">
                <span class="text-xs text-muted-foreground">{{ t().joinedLabel }} {{ t().joinedDate }}</span>
              </div>
            </div>
          </div>
        </ui-hover-card-content>
      </ui-hover-card>
    </section>
  `,
})
export class HoverCardDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => HOVER_CARD_DEMO_LOCALES[this.localeId()] ?? HOVER_CARD_DEMO_LOCALES['en'],
  );
}
