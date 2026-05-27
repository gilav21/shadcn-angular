// demo/src/app/demos/inputs/radio-group-demo.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  RadioGroupComponent,
  RadioGroupItemComponent,
  LabelComponent,
} from '../../../../../packages/components/ui';
import { RADIO_GROUP_DEMO_LOCALES } from './radio-group-demo.locales';

@Component({
  selector: 'app-radio-group-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RadioGroupComponent, RadioGroupItemComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="radio-group" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-radio-group class="max-w-sm">
        <div class="flex items-center gap-2">
          <ui-radio-group-item value="option1" />
          <ui-label>{{ t().optionDefault }}</ui-label>
        </div>
        <div class="flex items-center gap-2">
          <ui-radio-group-item value="option2" />
          <ui-label>{{ t().optionComfortable }}</ui-label>
        </div>
        <div class="flex items-center gap-2">
          <ui-radio-group-item value="option3" />
          <ui-label>{{ t().optionCompact }}</ui-label>
        </div>
      </ui-radio-group>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleModeTitle }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleModeDescription }}</p>
      <ui-radio-group class="max-w-sm">
        <ui-radio-group-item value="easy" [label]="t().labelEasyToUse" />
        <ui-radio-group-item value="flexible" [label]="t().labelFlexibleConfig" />
        <ui-radio-group-item value="accessible" [label]="t().labelFullyAccessible" />
      </ui-radio-group>

      <h3 class="text-lg font-medium mt-8">{{ t().dataDrivenTitle }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().dataDrivenDescription }}</p>
      <ui-radio-group class="max-w-sm" [options]="radioOptions()" />
    </section>
  `,
})
export class RadioGroupDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => RADIO_GROUP_DEMO_LOCALES[this.localeId()] ?? RADIO_GROUP_DEMO_LOCALES['en'],
  );
  protected readonly radioOptions = computed(() => [
    this.t().optionDefault,
    this.t().optionComfortable,
    this.t().optionCompact,
  ]);
}
