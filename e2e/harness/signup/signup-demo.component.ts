import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SignupBlockComponent, type SignupSubmit } from '@/blocks/signup';

/** Harness for the `signup` block — surfaces emissions for the spec to assert. */
@Component({
    selector: 'app-signup-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SignupBlockComponent],
    template: `
        <main class="p-8">
            <ui-signup-block data-testid="root" (submitted)="onSubmit($event)" />
            <p data-testid="submit-count">{{ count() }}</p>
            @if (payload(); as p) {
                <p data-testid="submitted">{{ p }}</p>
            }
        </main>
    `,
})
export class SignupDemoComponent {
    protected readonly payload = signal('');
    protected readonly count = signal(0);

    protected onSubmit(event: SignupSubmit): void {
        this.count.update(n => n + 1);
        this.payload.set(`${event.name}|${event.email}|${event.acceptTerms}`);
    }
}
