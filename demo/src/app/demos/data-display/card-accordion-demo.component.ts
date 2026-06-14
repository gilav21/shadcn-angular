import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ButtonComponent,
  CardAccordionComponent,
  CardAccordionItemComponent,
  CardAccordionTriggerComponent,
  CardAccordionActionsComponent,
  CardAccordionContentComponent,
} from '../../../../../packages/components/ui';

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
      <h2 id="card-accordion" class="text-2xl font-semibold scroll-m-20">Card Accordion</h2>
      <p class="text-muted-foreground">
        Collapsible sections styled as elevated cards with a smooth height animation.
      </p>

      <h3 class="text-lg font-medium mt-8">Simple mode</h3>
      <p class="text-muted-foreground text-sm mb-4">
        Drive each panel with <code>title</code>, <code>description</code> and <code>content</code> inputs.
      </p>
      <ui-card-accordion class="mx-auto max-w-xl">
        <ui-card-accordion-item
          value="what"
          title="What is shadcn-angular?"
          description="The basics"
          content="A copy-paste component library you fully own inside your own project."
        />
        <ui-card-accordion-item
          value="custom"
          title="Is it customizable?"
          description="Completely"
          content="Every component exposes a class input and supports content projection."
        />
        <ui-card-accordion-item
          value="animated"
          title="Is it animated?"
          content="Yes — panels expand and collapse with a smooth grid-rows height transition."
        />
      </ui-card-accordion>

      <h3 class="text-lg font-medium mt-8">Custom mode with header actions</h3>
      <p class="text-muted-foreground text-sm mb-4">
        Project a trigger, an actions slot, and content. Action clicks never toggle the panel.
      </p>
      <ui-card-accordion class="mx-auto max-w-xl">
        <ui-card-accordion-item value="billing">
          <ui-card-accordion-trigger>Billing settings</ui-card-accordion-trigger>
          <ui-card-accordion-actions>
            <ui-button variant="ghost" size="sm">Manage</ui-button>
          </ui-card-accordion-actions>
          <ui-card-accordion-content>
            Update your subscription, payment methods and download invoices.
          </ui-card-accordion-content>
        </ui-card-accordion-item>
        <ui-card-accordion-item value="team">
          <ui-card-accordion-trigger>Team members</ui-card-accordion-trigger>
          <ui-card-accordion-actions>
            <ui-button variant="outline" size="sm">Invite</ui-button>
          </ui-card-accordion-actions>
          <ui-card-accordion-content>
            Invite teammates and manage their roles and permissions here.
          </ui-card-accordion-content>
        </ui-card-accordion-item>
      </ui-card-accordion>

      <h3 class="text-lg font-medium mt-8">Multiple open</h3>
      <p class="text-muted-foreground text-sm mb-4">
        Use <code>type="multiple"</code> to let several panels stay open at once;
        <code>openValues</code> sets the defaults.
      </p>
      <ui-card-accordion type="multiple" [openValues]="['a', 'b']" class="mx-auto max-w-xl">
        <ui-card-accordion-item value="a" title="First panel" content="Several panels can stay open together." />
        <ui-card-accordion-item value="b" title="Second panel" content="This one starts open too." />
        <ui-card-accordion-item value="c" title="Third panel" content="Toggle each one independently." />
      </ui-card-accordion>

      <h3 class="text-lg font-medium mt-8">Always one open</h3>
      <p class="text-muted-foreground text-sm mb-4">
        With <code>[collapsible]="false"</code> in single mode, the active panel can't be closed by clicking it again.
      </p>
      <ui-card-accordion type="single" [collapsible]="false" [openValues]="['one']" class="mx-auto max-w-xl">
        <ui-card-accordion-item value="one" title="Section one" content="Exactly one panel stays open at all times." />
        <ui-card-accordion-item value="two" title="Section two" content="Selecting another panel moves the open state here." />
      </ui-card-accordion>
    </section>
  `,
})
export class CardAccordionDemoComponent {}
