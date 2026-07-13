import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { UiConfettiDirective } from '@/components/ui/confetti.directive';

/** Harness for the `confetti` directive. */
@Component({
    selector: 'app-confetti-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [UiConfettiDirective],
    template: `
        <main class="p-8">
            <div
                uiConfetti
                [manualTrigger]="fired()"
                data-testid="root"
                class="h-64 w-96 rounded-md border"
            >
                Party zone
            </div>
            <button type="button" data-testid="fire" (click)="fired.set(true)">Fire</button>
        </main>
    `,
})
export class ConfettiDemoComponent {
    readonly fired = signal(false);
}
