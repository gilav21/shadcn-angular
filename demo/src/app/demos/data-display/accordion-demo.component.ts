import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  AccordionComponent,
  AccordionContentComponent,
  AccordionItemComponent,
  AccordionTriggerComponent,
} from '../../../../../packages/components/ui';

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
      <h2 id="accordion" class="text-2xl font-semibold scroll-m-20">Accordion</h2>
      <p class="text-muted-foreground">Collapsible content sections.</p>

      <ui-accordion class="max-w-md">
        <ui-accordion-item value="item-1">
          <ui-accordion-trigger>Is it accessible?</ui-accordion-trigger>
          <ui-accordion-content>
            Yes. It adheres to the WAI-ARIA design pattern.
          </ui-accordion-content>
        </ui-accordion-item>
        <ui-accordion-item value="item-2">
          <ui-accordion-trigger>Is it styled?</ui-accordion-trigger>
          <ui-accordion-content>
            Yes. It comes with default styles that match the other components.
          </ui-accordion-content>
        </ui-accordion-item>
        <ui-accordion-item value="item-3">
          <ui-accordion-trigger>Is it animated?</ui-accordion-trigger>
          <ui-accordion-content>
            Yes. It's animated by default with smooth transitions.
          </ui-accordion-content>
        </ui-accordion-item>
      </ui-accordion>

      <h3 class="text-lg font-medium mt-8">Simple Mode (Data-driven)</h3>
      <p class="text-muted-foreground text-sm mb-4">Using title and content inputs instead of content projection.
      </p>
      <ui-accordion class="max-w-md">
        <ui-accordion-item value="simple-1" title="What is Angular?"
          content="Angular is a TypeScript-based web application framework." />
        <ui-accordion-item value="simple-2" title="What are Signals?"
          content="Signals are a reactive primitive for managing state in Angular." />
        <ui-accordion-item value="simple-3" title="What is OnPush?"
          content="OnPush is a change detection strategy that optimizes performance." />
      </ui-accordion>
    </section>
  `,
})
export class AccordionDemoComponent {}
