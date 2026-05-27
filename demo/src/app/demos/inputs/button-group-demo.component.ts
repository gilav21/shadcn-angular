import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  ButtonComponent,
  ButtonGroupComponent,
  ButtonGroupTextComponent,
  InputComponent,
} from '../../../../../packages/components/ui';
import { BUTTON_GROUP_DEMO_LOCALES } from './button-group-demo.locales';

@Component({
  selector: 'app-button-group-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ButtonGroupComponent, ButtonGroupTextComponent, InputComponent],
  template: `
    <section class="space-y-4">
      <h2 id="button-group" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-wrap gap-6">
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">{{ t().horizontalLabel }}</span>
          <ui-button-group>
            <ui-button variant="outline">{{ t().left }}</ui-button>
            <ui-button variant="outline">{{ t().center }}</ui-button>
            <ui-button variant="outline">{{ t().right }}</ui-button>
          </ui-button-group>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">{{ t().verticalLabel }}</span>
          <ui-button-group orientation="vertical">
            <ui-button variant="outline">{{ t().top }}</ui-button>
            <ui-button variant="outline">{{ t().middle }}</ui-button>
            <ui-button variant="outline">{{ t().bottom }}</ui-button>
          </ui-button-group>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">{{ t().withTextLabel }}</span>
          <ui-button-group>
            <ui-button-group-text>https://</ui-button-group-text>
            <ui-input class="rounded-none border-x-0" [placeholder]="t().urlPlaceholder" />
            <ui-button-group-text>.com</ui-button-group-text>
          </ui-button-group>
        </div>
      </div>
    </section>
  `,
})
export class ButtonGroupDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => BUTTON_GROUP_DEMO_LOCALES[this.localeId()] ?? BUTTON_GROUP_DEMO_LOCALES['en'],
  );
}
