import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DurationInputComponent } from '@/components/ui/duration-input';

/** Harness for `duration-input` in a pristine consumer app. */
@Component({
    selector: 'app-duration-input-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DurationInputComponent],
    template: `
        <main class="space-y-6 p-8">
            <ui-duration-input
                data-testid="root"
                [(value)]="duration"
                [units]="['hours', 'minutes']"
                ariaLabel="Duration"
            />
            <p data-testid="value">{{ duration() ?? 'null' }}</p>

            <ui-duration-input
                data-testid="absorbing"
                [value]="5400"
                [units]="['minutes', 'seconds']"
                ariaLabel="Minutes and seconds"
            />
        </main>
    `,
})
export class DurationInputDemoComponent {
    readonly duration = signal<number | null>(5400);
}
