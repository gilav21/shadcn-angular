import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LoginBlockComponent, type LoginSubmit } from '@/blocks/login';

/**
 * Harness for the `login` block. The block only emits — showing the result is
 * the consuming app's job, so the demo renders the payload into a testid the
 * spec can read.
 */
@Component({
    selector: 'app-login-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [LoginBlockComponent],
    template: `
        <main class="p-8">
            <ui-login-block data-testid="root" (submitted)="onSubmit($event)" />
            <p data-testid="submit-count">{{ count() }}</p>
            @if (payload(); as p) {
                <p data-testid="submitted">{{ p }}</p>
            }
        </main>
    `,
})
export class LoginDemoComponent {
    protected readonly payload = signal('');
    protected readonly count = signal(0);

    protected onSubmit(event: LoginSubmit): void {
        this.count.update(n => n + 1);
        this.payload.set(`${event.email}|${event.password}|${event.remember}`);
    }
}
