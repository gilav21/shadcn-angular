import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    AccordionComponent,
    AccordionItemComponent,
    AccordionTriggerComponent,
    AccordionContentComponent,
} from '@/components/ui/accordion';

@Component({
    selector: 'app-accordion-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AccordionComponent,
        AccordionItemComponent,
        AccordionTriggerComponent,
        AccordionContentComponent,
    ],
    template: `
        <main class="p-8 space-y-8">
            <section>
                <h2>Single mode</h2>
                <ui-accordion type="single" data-testid="single">
                    <ui-accordion-item value="a">
                        <ui-accordion-trigger data-testid="single-trigger-a">Item A</ui-accordion-trigger>
                        <ui-accordion-content data-testid="single-content-a">Content of A</ui-accordion-content>
                    </ui-accordion-item>
                    <ui-accordion-item value="b">
                        <ui-accordion-trigger data-testid="single-trigger-b">Item B</ui-accordion-trigger>
                        <ui-accordion-content data-testid="single-content-b">Content of B</ui-accordion-content>
                    </ui-accordion-item>
                </ui-accordion>
            </section>
            <section>
                <h2>Multiple mode</h2>
                <ui-accordion type="multiple" data-testid="multi">
                    <ui-accordion-item value="x">
                        <ui-accordion-trigger data-testid="multi-trigger-x">Item X</ui-accordion-trigger>
                        <ui-accordion-content data-testid="multi-content-x">Content of X</ui-accordion-content>
                    </ui-accordion-item>
                    <ui-accordion-item value="y">
                        <ui-accordion-trigger data-testid="multi-trigger-y">Item Y</ui-accordion-trigger>
                        <ui-accordion-content data-testid="multi-content-y">Content of Y</ui-accordion-content>
                    </ui-accordion-item>
                </ui-accordion>
            </section>
        </main>
    `,
})
export class AccordionDemoComponent {
    // Marker signal makes the file non-trivial for OnPush change detection
    // patterns; not used by the spec but useful when iterating manually.
    protected readonly _ = signal(0);
}
