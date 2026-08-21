import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    ErrorPageActionsComponent,
    ErrorPageComponent,
    ErrorPageIllustrationComponent,
} from '@/components/ui/error-page';

/**
 * Harness for the `error-page` component.
 *
 * The `lastEvent` readout exists so the spec can prove the outputs actually
 * fire in a real consumer app — the component never routes, so an emission is
 * the only observable effect of pressing a default action.
 */
@Component({
    selector: 'app-error-page-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ErrorPageComponent,
        ErrorPageIllustrationComponent,
        ErrorPageActionsComponent,
    ],
    template: `
        <main class="p-8 space-y-8">
            <ui-error-page
                data-testid="default"
                code="404"
                (goBack)="lastEvent.set('goBack')"
                (goHome)="lastEvent.set('goHome')"
            />

            <p data-testid="last-event">{{ lastEvent() || 'none' }}</p>

            <ui-error-page data-testid="unknown" code="418" />

            <ui-error-page data-testid="illustrated" code="500">
                <ui-error-page-illustration>
                    <svg data-testid="custom-art" viewBox="0 0 60 40" class="h-20 w-auto">
                        <rect x="5" y="5" width="50" height="30" fill="none" stroke="currentColor" />
                    </svg>
                </ui-error-page-illustration>
            </ui-error-page>

            <ui-error-page data-testid="custom-actions" code="403">
                <ui-error-page-actions>
                    <button data-testid="custom-action">Take me elsewhere</button>
                </ui-error-page-actions>
            </ui-error-page>
        </main>
    `,
})
export class ErrorPageDemoComponent {
    readonly lastEvent = signal('');
}
