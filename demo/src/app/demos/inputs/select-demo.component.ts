import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import {
  SelectComponent,
  SelectTriggerComponent,
  SelectValueComponent,
  SelectContentComponent,
  SelectItemComponent,
  SelectGroupComponent,
  SelectLabelComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SELECT_DEMO_LOCALES } from './select-demo.locales';

@Component({
  selector: 'app-select-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent,
    SelectGroupComponent,
    SelectLabelComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="select" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-wrap gap-8">
        <div class="space-y-2">
          <h3 class="text-sm font-medium">{{ t().itemAlignedHeading }}</h3>
          <p class="text-xs text-muted-foreground">{{ t().itemAlignedDescription }}</p>
          <ui-select class="w-[200px]" position="item-aligned">
            <ui-select-trigger>
              <ui-select-value [placeholder]="t().selectFruitPlaceholder" />
            </ui-select-trigger>
            <ui-select-content>
              <ui-select-group>
                <ui-select-label>{{ t().fruitsLabel }}</ui-select-label>
                <ui-select-item value="apple">{{ t().apple }}</ui-select-item>
                <ui-select-item value="banana">{{ t().banana }}</ui-select-item>
                <ui-select-item value="blueberry">{{ t().blueberry }}</ui-select-item>
                <ui-select-item value="grapes">{{ t().grapes }}</ui-select-item>
                <ui-select-item value="pineapple">{{ t().pineapple }}</ui-select-item>
              </ui-select-group>
            </ui-select-content>
          </ui-select>
        </div>

        <div class="space-y-2">
          <h3 class="text-sm font-medium">{{ t().simpleModeHeading }}</h3>
          <p class="text-xs text-muted-foreground">{{ t().simpleModeDescription }}</p>
          <ui-select class="w-[200px]" [options]="selectOptions()" [placeholder]="t().selectFruitPlaceholder" />
        </div>

        <div class="space-y-2">
          <h3 class="text-sm font-medium">{{ t().popperHeading }}</h3>
          <p class="text-xs text-muted-foreground">{{ t().popperDescription }}</p>
          <ui-select class="w-[200px]" position="popper">
            <ui-select-trigger>
              <ui-select-value [placeholder]="t().selectFruitPlaceholder" />
            </ui-select-trigger>
            <ui-select-content>
              <ui-select-group>
                <ui-select-label>{{ t().fruitsLabel }}</ui-select-label>
                <ui-select-item value="apple">{{ t().apple }}</ui-select-item>
                <ui-select-item value="banana">{{ t().banana }}</ui-select-item>
                <ui-select-item value="blueberry">{{ t().blueberry }}</ui-select-item>
                <ui-select-item value="grapes">{{ t().grapes }}</ui-select-item>
                <ui-select-item value="pineapple">{{ t().pineapple }}</ui-select-item>
              </ui-select-group>
            </ui-select-content>
          </ui-select>
        </div>

        <div class="space-y-2">
          <h3 class="text-sm font-medium">{{ t().disabledItemHeading }}</h3>
          <p class="text-xs text-muted-foreground">{{ t().disabledItemDescription }}</p>
          <ui-select class="w-[200px]">
            <ui-select-trigger>
              <ui-select-value [placeholder]="t().selectFruitPlaceholder" />
            </ui-select-trigger>
            <ui-select-content>
              <ui-select-group>
                <ui-select-label>{{ t().fruitsLabel }}</ui-select-label>
                <ui-select-item value="apple">{{ t().apple }}</ui-select-item>
                <ui-select-item value="banana" [disabled]="true">{{ t().banana }}</ui-select-item>
                <ui-select-item value="blueberry">{{ t().blueberry }}</ui-select-item>
                <ui-select-item value="grapes">{{ t().grapes }}</ui-select-item>
                <ui-select-item value="pineapple">{{ t().pineapple }}</ui-select-item>
              </ui-select-group>
            </ui-select-content>
          </ui-select>
        </div>
      </div>
    </section>
  `,
})
export class SelectDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => SELECT_DEMO_LOCALES[this.localeId()] ?? SELECT_DEMO_LOCALES['en']);

  readonly selectOptions = computed(() => {
    const loc = this.t();
    return [loc.apple, loc.banana, loc.blueberry, loc.grapes, loc.pineapple];
  });
}
