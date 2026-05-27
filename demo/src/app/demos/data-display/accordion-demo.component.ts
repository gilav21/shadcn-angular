import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  AccordionComponent,
  AccordionContentComponent,
  AccordionItemComponent,
  AccordionTriggerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ACCORDION_DEMO_LOCALES } from './accordion-demo.locales';

@Component({
  selector: 'app-accordion-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccordionComponent,
    AccordionItemComponent,
    AccordionTriggerComponent,
    AccordionContentComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="accordion" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-accordion class="max-w-md">
        <ui-accordion-item value="item-1">
          <ui-accordion-trigger>{{ t().item1Question }}</ui-accordion-trigger>
          <ui-accordion-content>
            {{ t().item1Answer }}
          </ui-accordion-content>
        </ui-accordion-item>
        <ui-accordion-item value="item-2">
          <ui-accordion-trigger>{{ t().item2Question }}</ui-accordion-trigger>
          <ui-accordion-content>
            {{ t().item2Answer }}
          </ui-accordion-content>
        </ui-accordion-item>
        <ui-accordion-item value="item-3">
          <ui-accordion-trigger>{{ t().item3Question }}</ui-accordion-trigger>
          <ui-accordion-content>
            {{ t().item3Answer }}
          </ui-accordion-content>
        </ui-accordion-item>
      </ui-accordion>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDescription }}</p>
      <ui-accordion class="max-w-md">
        <ui-accordion-item value="simple-1" [title]="t().simpleItem1Title"
          [content]="t().simpleItem1Content" />
        <ui-accordion-item value="simple-2" [title]="t().simpleItem2Title"
          [content]="t().simpleItem2Content" />
        <ui-accordion-item value="simple-3" [title]="t().simpleItem3Title"
          [content]="t().simpleItem3Content" />
      </ui-accordion>
    </section>
  `,
})
export class AccordionDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => ACCORDION_DEMO_LOCALES[this.localeId()] ?? ACCORDION_DEMO_LOCALES['en']);
}
