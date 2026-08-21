import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ForgotPasswordBlockComponent, type ForgotPasswordSubmit } from '@/blocks/forgot-password';

/**
 * Harness for the `forgot-password` block. The block emits the address; showing
 * the "check your inbox" confirmation is the app's job, so the demo does it.
 */
@Component({
    selector: 'app-forgot-password-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ForgotPasswordBlockComponent],
    template: `
        <main class="p-8">
            @if (sentTo()) {
                <p data-testid="confirmation">Reset link sent to {{ sentTo() }}</p>
            } @else {
                <ui-forgot-password-block data-testid="root" (submitted)="onSubmit($event)" />
            }
        </main>
    `,
})
export class ForgotPasswordDemoComponent {
    protected readonly sentTo = signal('');

    protected onSubmit(event: ForgotPasswordSubmit): void {
        this.sentTo.set(event.email);
    }
}
