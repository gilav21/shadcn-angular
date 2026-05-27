import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  IconComponent,
  InputComponent,
  InputGroupComponent,
  InputGroupAddonComponent,
  InputGroupTextComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { INPUT_GROUP_DEMO_LOCALES } from './input-group-demo.locales';

@Component({
  selector: 'app-input-group-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    IconComponent,
    InputComponent,
    InputGroupComponent,
    InputGroupAddonComponent,
    InputGroupTextComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="input-group" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="grid gap-4 max-w-md">
        <ui-input-group>
          <ui-input-group-addon>
            <ui-icon name="search" size="sm" />
          </ui-input-group-addon>
          <ui-input [placeholder]="t().searchPlaceholder" />
        </ui-input-group>

        <ui-input-group>
          <ui-input-group-addon>$</ui-input-group-addon>
          <ui-input placeholder="0.00" type="number" />
          <ui-input-group-addon align="inline-end">
            <ui-input-group-text>USD</ui-input-group-text>
          </ui-input-group-addon>
        </ui-input-group>

        <ui-input-group>
          <ui-input-group-addon>
            <ui-icon name="map-pin" size="sm" />
          </ui-input-group-addon>
          <ui-input [placeholder]="t().locationPlaceholder" />
          <ui-input-group-addon align="inline-end">
            <ui-button variant="ghost" size="sm">{{ t().locateButton }}</ui-button>
          </ui-input-group-addon>
        </ui-input-group>
      </div>
    </section>
  `,
})
export class InputGroupDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => INPUT_GROUP_DEMO_LOCALES[this.localeId()] ?? INPUT_GROUP_DEMO_LOCALES['en']);
}
