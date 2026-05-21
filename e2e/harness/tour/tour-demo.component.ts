import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TourComponent, type TourStep } from '@/components/ui/tour';

@Component({
    selector: 'app-tour-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TourComponent],
    template: `
        <main class="p-8 space-y-8">
            <button type="button" data-testid="step-one" class="border px-3 py-1">
                Step one target
            </button>
            <button type="button" data-testid="step-two" class="border px-3 py-1">
                Step two target
            </button>
            <button type="button" data-testid="start" (click)="active.set(true)"
                class="border px-3 py-1">
                Start tour
            </button>

            <ui-tour
                [steps]="steps"
                [active]="active()"
                (activeChange)="active.set($event)"
                (done)="active.set(false)"
            />
        </main>
    `,
})
export class TourDemoComponent {
    protected readonly active = signal(false);
    protected readonly steps: TourStep[] = [
        {
            target: '[data-testid="step-one"]',
            title: 'First step',
            description: 'This is the first stop.',
        },
        {
            target: '[data-testid="step-two"]',
            title: 'Second step',
            description: 'This is the second stop.',
        },
    ];
}
