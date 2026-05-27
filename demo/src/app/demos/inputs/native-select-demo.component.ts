import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { NativeSelectComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { NATIVE_SELECT_DEMO_LOCALES } from './native-select-demo.locales';

@Component({
  selector: 'app-native-select-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NativeSelectComponent],
  template: `
    <section class="space-y-4">
      <h2 id="native-select" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-wrap gap-4">
        <ui-native-select>
          <option value="">{{ t().selectRole }}</option>
          <option value="admin">{{ t().optionAdmin }}</option>
          <option value="editor">{{ t().optionEditor }}</option>
          <option value="viewer">{{ t().optionViewer }}</option>
        </ui-native-select>

        <ui-native-select size="sm">
          <option value="">{{ t().smallSize }}</option>
          <option value="1">{{ t().option1 }}</option>
          <option value="2">{{ t().option2 }}</option>
        </ui-native-select>

        <ui-native-select [disabled]="true">
          <option value="">{{ t().optionDisabled }}</option>
        </ui-native-select>

        <ui-native-select [invalid]="true">
          <option value="">{{ t().optionInvalid }}</option>
        </ui-native-select>
      </div>
    </section>
  `,
})
export class NativeSelectDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => NATIVE_SELECT_DEMO_LOCALES[this.localeId()] ?? NATIVE_SELECT_DEMO_LOCALES['en']);
}
