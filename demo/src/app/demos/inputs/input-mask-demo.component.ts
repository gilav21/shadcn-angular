import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { InputComponent, LabelComponent, InputMaskDirective } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { INPUT_MASK_DEMO_LOCALES } from './input-mask-demo.locales';

@Component({
  selector: 'app-input-mask-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputComponent, LabelComponent, InputMaskDirective],
  template: `
    <section class="space-y-4">
      <h2 id="input-mask" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="grid gap-4 max-w-sm">
        <div class="space-y-2">
          <ui-label>{{ t().phoneLabel }}</ui-label>
          <ui-input uiInputMask="(000) 000-0000" placeholder="(555) 555-5555" />
        </div>

        <div class="space-y-2">
          <ui-label>{{ t().dateLabel }}</ui-label>
          <ui-input uiInputMask="99/99/9999" slotChar="_" placeholder="MM/DD/YYYY" />
        </div>

        <div class="space-y-2">
          <ui-label>{{ t().licensePlateLabel }}</ui-label>
          <ui-input uiInputMask="AAA-999" placeholder="ABC-123" />
        </div>

        <div class="space-y-2">
          <ui-label>{{ t().nativeInputLabel }}</ui-label>
          <input
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            uiInputMask="(000) 000-0000" placeholder="Native input (000) 000-0000" />
        </div>
      </div>
    </section>
  `,
})
export class InputMaskDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => INPUT_MASK_DEMO_LOCALES[this.localeId()] ?? INPUT_MASK_DEMO_LOCALES['en']);
}
