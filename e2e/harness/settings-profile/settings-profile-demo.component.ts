import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SettingsProfileBlockComponent, type ProfileSubmit } from '@/blocks/settings-profile';

/** Harness for the `settings-profile` block. */
@Component({
    selector: 'app-settings-profile-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SettingsProfileBlockComponent],
    template: `
        <main class="p-8">
            <ui-settings-profile-block data-testid="root" (submitted)="onSubmit($event)" />
            <p data-testid="submit-count">{{ count() }}</p>
            @if (payload(); as p) {
                <p data-testid="submitted">{{ p }}</p>
            }
        </main>
    `,
})
export class SettingsProfileDemoComponent {
    protected readonly payload = signal('');
    protected readonly count = signal(0);

    protected onSubmit(event: ProfileSubmit): void {
        this.count.update(n => n + 1);
        this.payload.set(`${event.name}|${event.role}|${event.bio}`);
    }
}
