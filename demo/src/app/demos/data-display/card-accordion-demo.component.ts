import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  CardAccordionComponent,
  CardAccordionItemComponent,
  CardAccordionTriggerComponent,
  CardAccordionActionsComponent,
  CardAccordionContentComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CARD_ACCORDION_DEMO_LOCALES } from './card-accordion-demo.locales';

@Component({
  selector: 'app-card-accordion-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CardAccordionComponent,
    CardAccordionItemComponent,
    CardAccordionTriggerComponent,
    CardAccordionActionsComponent,
    CardAccordionContentComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="card-accordion" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDescription }}</p>
      <ui-card-accordion class="mx-auto max-w-xl">
        <ui-card-accordion-item value="what" [title]="t().s1Title" [description]="t().s1Desc" [content]="t().s1Content" />
        <ui-card-accordion-item value="custom" [title]="t().s2Title" [description]="t().s2Desc" [content]="t().s2Content" />
        <ui-card-accordion-item value="animated" [title]="t().s3Title" [content]="t().s3Content" />
      </ui-card-accordion>

      <h3 class="text-lg font-medium mt-8">{{ t().customHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().customDescription }}</p>
      <ui-card-accordion class="mx-auto max-w-xl">
        <ui-card-accordion-item value="billing">
          <ui-card-accordion-trigger>
            {{ t().billingTitle }}
            <ui-card-accordion-actions>
              <ui-button variant="ghost" size="sm">{{ t().billingAction }}</ui-button>
            </ui-card-accordion-actions>
          </ui-card-accordion-trigger>
          <ui-card-accordion-content>{{ t().billingContent }}</ui-card-accordion-content>
        </ui-card-accordion-item>
        <ui-card-accordion-item value="team">
          <ui-card-accordion-trigger>
            {{ t().teamTitle }}
            <ui-card-accordion-actions>
              <ui-button variant="outline" size="sm">{{ t().teamAction }}</ui-button>
            </ui-card-accordion-actions>
          </ui-card-accordion-trigger>
          <ui-card-accordion-content>{{ t().teamContent }}</ui-card-accordion-content>
        </ui-card-accordion-item>
      </ui-card-accordion>

      <h3 class="text-lg font-medium mt-8">{{ t().multipleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().multipleDescription }}</p>
      <ui-card-accordion type="multiple" [openValues]="['a', 'b']" class="mx-auto max-w-xl">
        <ui-card-accordion-item value="a" [title]="t().m1Title" [content]="t().m1Content" />
        <ui-card-accordion-item value="b" [title]="t().m2Title" [content]="t().m2Content" />
        <ui-card-accordion-item value="c" [title]="t().m3Title" [content]="t().m3Content" />
      </ui-card-accordion>

      <h3 class="text-lg font-medium mt-8">{{ t().collapsibleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().collapsibleDescription }}</p>
      <ui-card-accordion type="single" [collapsible]="false" [openValues]="['one']" class="mx-auto max-w-xl">
        <ui-card-accordion-item value="one" [title]="t().c1Title" [content]="t().c1Content" />
        <ui-card-accordion-item value="two" [title]="t().c2Title" [content]="t().c2Content" />
      </ui-card-accordion>
    </section>
  `,
})
export class CardAccordionDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => CARD_ACCORDION_DEMO_LOCALES[this.localeId()] ?? CARD_ACCORDION_DEMO_LOCALES['en']);
}
