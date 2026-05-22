import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    CollapsibleComponent,
    CollapsibleTriggerComponent,
    CollapsibleContentComponent,
} from '@/components/ui/collapsible';

@Component({
    selector: 'app-collapsible-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CollapsibleComponent, CollapsibleTriggerComponent, CollapsibleContentComponent,
    ],
    template: `
        <main class="p-8">
            <ui-collapsible>
                <ui-collapsible-trigger data-testid="trigger">
                    <button type="button" class="border px-3 py-1">Show details</button>
                </ui-collapsible-trigger>
                <ui-collapsible-content>
                    <p data-testid="content">Hidden until expanded.</p>
                </ui-collapsible-content>
            </ui-collapsible>
        </main>
    `,
})
export class CollapsibleDemoComponent {}
