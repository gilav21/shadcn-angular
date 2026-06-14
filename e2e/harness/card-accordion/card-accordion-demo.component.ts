import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    CardAccordionComponent,
    CardAccordionItemComponent,
    CardAccordionTriggerComponent,
    CardAccordionActionsComponent,
    CardAccordionContentComponent,
} from '@/components/ui/card-accordion';

/**
 * Harness for the `card-accordion` component. Exercises custom mode with a
 * header action and a multiple-open accordion.
 */
@Component({
    selector: 'app-card-accordion-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CardAccordionComponent,
        CardAccordionItemComponent,
        CardAccordionTriggerComponent,
        CardAccordionActionsComponent,
        CardAccordionContentComponent,
    ],
    template: `
        <main class="p-8 space-y-8">
            <ui-card-accordion data-testid="root" type="single">
                <ui-card-accordion-item value="one">
                    <ui-card-accordion-trigger data-testid="trigger-one">First panel</ui-card-accordion-trigger>
                    <ui-card-accordion-actions>
                        <button type="button" data-testid="action-one" (click)="actionClicks.set(actionClicks() + 1)">
                            Action
                        </button>
                    </ui-card-accordion-actions>
                    <ui-card-accordion-content>
                        <p data-testid="content-one">First panel body</p>
                    </ui-card-accordion-content>
                </ui-card-accordion-item>
                <ui-card-accordion-item value="two">
                    <ui-card-accordion-trigger data-testid="trigger-two">Second panel</ui-card-accordion-trigger>
                    <ui-card-accordion-content>
                        <p data-testid="content-two">Second panel body</p>
                    </ui-card-accordion-content>
                </ui-card-accordion-item>
            </ui-card-accordion>

            <p data-testid="action-count">{{ actionClicks() }}</p>

            <ui-card-accordion data-testid="multiple-root" type="multiple">
                <ui-card-accordion-item value="m1" title="Multi one" content="Body one" />
                <ui-card-accordion-item value="m2" title="Multi two" content="Body two" />
            </ui-card-accordion>
        </main>
    `,
})
export class CardAccordionDemoComponent {
    readonly actionClicks = signal(0);
}
