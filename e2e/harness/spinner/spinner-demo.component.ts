import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    SpinnerComponent,
    PageSpinnerComponent,
} from '@/components/ui/spinner';

/**
 * Auto-generated harness for the `spinner` component.
 * Extend the template and assertions in `spinner.spec.ts` as needed.
 */
@Component({
    selector: 'app-spinner-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SpinnerComponent, PageSpinnerComponent],
    template: `
        <main class="p-8">
            <ui-spinner data-testid="root"></ui-spinner>
            <ui-page-spinner data-testid="page-spinner"></ui-page-spinner>
        </main>
    `,
})
export class SpinnerDemoComponent {}
