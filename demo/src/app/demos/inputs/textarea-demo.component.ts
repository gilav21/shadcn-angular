// demo/src/app/demos/inputs/textarea-demo.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TextareaComponent, LabelComponent } from '../../../../../packages/components/ui';
import { TEXTAREA_DEMO_LOCALES } from './textarea-demo.locales';

@Component({
  selector: 'app-textarea-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextareaComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="textarea" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="grid gap-4 max-w-sm">
        <div class="space-y-2">
          <ui-label>{{ t().labelMessage }}</ui-label>
          <ui-textarea [placeholder]="t().placeholderMessage" [rows]="4" />
        </div>
        <div class="space-y-2">
          <ui-label>{{ t().labelUnderline }}</ui-label>
          <ui-textarea [placeholder]="t().placeholderUnderline" [rows]="4" variant="underline" />
        </div>
        <ui-textarea [placeholder]="t().placeholderDisabled" [disabled]="true" />
      </div>
    </section>
  `,
})
export class TextareaDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => TEXTAREA_DEMO_LOCALES[this.localeId()] ?? TEXTAREA_DEMO_LOCALES['en'],
  );
}
