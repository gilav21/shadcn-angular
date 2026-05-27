// demo/src/app/demos/inputs/input-demo.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  InputComponent,
  LabelComponent,
  InputGroupComponent,
  InputGroupAddonComponent,
} from '../../../../../packages/components/ui';
import { INPUT_DEMO_LOCALES } from './input-demo.locales';

@Component({
  selector: 'app-input-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    InputComponent,
    LabelComponent,
    InputGroupComponent,
    InputGroupAddonComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="input" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-2 max-w-sm">
        <ui-label>{{ t().groupStandardLabel }}</ui-label>
        <ui-input-group>
          <ui-input-group-addon>$</ui-input-group-addon>
          <ui-input [placeholder]="t().amountPlaceholder"></ui-input>
          <ui-input-group-addon>USD</ui-input-group-addon>
        </ui-input-group>
        <p class="text-xs text-muted-foreground">{{ t().groupStandardHint }}</p>
      </div>

      <div class="grid gap-4 max-w-sm">
        <div class="space-y-2">
          <ui-label for="email">{{ t().emailLabel }}</ui-label>
          <ui-input type="email" [placeholder]="t().emailPlaceholder" [attr.id]="'email'" />
        </div>

        <div class="space-y-2">
          <ui-label for="password">{{ t().passwordLabel }}</ui-label>
          <ui-input type="password" [placeholder]="t().passwordPlaceholder" [attr.id]="'password'" />
        </div>

        <div class="space-y-2">
          <ui-label for="underline-input">{{ t().underlineLabel }}</ui-label>
          <ui-input [placeholder]="t().underlinePlaceholder" [attr.id]="'underline-input'" variant="underline" />
        </div>

        <ui-input [placeholder]="t().disabledPlaceholder" [disabled]="true" />
      </div>

      <div class="grid gap-4 max-w-sm pt-4">
        <div class="space-y-2">
          <ui-label>{{ t().groupUnderlineLabel }}</ui-label>
          <ui-input-group variant="underline">
            <ui-input-group-addon>$</ui-input-group-addon>
            <ui-input [placeholder]="t().amountPlaceholder"></ui-input>
            <ui-input-group-addon>USD</ui-input-group-addon>
          </ui-input-group>
        </div>

        <div class="space-y-2">
          <ui-label>{{ t().groupGhostLabel }}</ui-label>
          <div class="rounded-lg border p-1">
            <ui-input-group variant="ghost">
              <ui-input-group-addon>$</ui-input-group-addon>
              <ui-input [placeholder]="t().amountPlaceholder"></ui-input>
              <ui-input-group-addon>USD</ui-input-group-addon>
            </ui-input-group>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class InputDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => INPUT_DEMO_LOCALES[this.localeId()] ?? INPUT_DEMO_LOCALES['en'],
  );
}
