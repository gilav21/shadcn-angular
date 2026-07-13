import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    AlertComponent,
    AlertTitleComponent,
    AlertDescriptionComponent,
} from '@/components/ui/alert';

/**
 * Auto-generated harness for the `alert` component.
 * Extend the template and assertions in `alert.spec.ts` as needed.
 */
@Component({
    selector: 'app-alert-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AlertComponent, AlertTitleComponent, AlertDescriptionComponent],
    template: `
        <main class="p-8">
            <ui-alert data-testid="root">
                <ui-alert-title data-testid="alert-title"></ui-alert-title>
                <ui-alert-description data-testid="alert-description"></ui-alert-description>
            </ui-alert>
        </main>
    `,
})
export class AlertDemoComponent {}
