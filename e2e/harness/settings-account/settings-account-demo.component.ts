import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SettingsAccountBlockComponent, type AccountSubmit } from '@/blocks/settings-account';

/** Harness for the `settings-account` block. */
@Component({
    selector: 'app-settings-account-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SettingsAccountBlockComponent],
    template: `
        <main class="p-8">
            <ui-settings-account-block
                data-testid="root"
                (submitted)="onSubmit($event)"
                (deleteRequested)="onDelete()" />
            <p data-testid="submit-count">{{ count() }}</p>
            <p data-testid="delete-count">{{ deletes() }}</p>
            @if (payload(); as p) {
                <p data-testid="submitted">{{ p }}</p>
            }
        </main>
    `,
})
export class SettingsAccountDemoComponent {
    protected readonly payload = signal('');
    protected readonly count = signal(0);
    protected readonly deletes = signal(0);

    protected onSubmit(event: AccountSubmit): void {
        this.count.update(n => n + 1);
        this.payload.set(`${event.email}|${event.currentPassword}|${event.newPassword}`);
    }

    protected onDelete(): void {
        this.deletes.update(n => n + 1);
    }
}
