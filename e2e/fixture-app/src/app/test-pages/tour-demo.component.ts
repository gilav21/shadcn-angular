import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TourComponent, type TourStep, type TourSkippedEvent } from '@/components/ui/tour';

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

            <button type="button" data-testid="start-async" (click)="asyncActive.set(true)"
                class="border px-3 py-1">
                Start async tour
            </button>
            <button type="button" data-testid="add-row" (click)="rows.set(['Row one'])"
                class="border px-3 py-1">
                Add a row
            </button>
            <button type="button" data-testid="slow-mode" (click)="slow.set(true)"
                class="border px-3 py-1">
                Slow hooks
            </button>
            <button type="button" data-testid="start-dead-end" (click)="deadEndActive.set(true)"
                class="border px-3 py-1">
                Start dead-end tour
            </button>

            <section class="flex gap-4">
                @if (panelOpen()) {
                    <aside data-testid="panel" class="border p-3">Side panel</aside>
                }
                <div class="border p-3">
                    @for (row of rows(); track row) {
                        <div data-testid="row">{{ row }}</div>
                    } @empty {
                        <p data-testid="empty">No rows yet</p>
                    }
                </div>
            </section>

            <p data-testid="skipped">{{ skipped().join(',') }}</p>

            <ui-tour
                [steps]="steps"
                [active]="active()"
                (activeChange)="active.set($event)"
                (done)="active.set(false)"
            />

            <ui-tour
                [steps]="deadEndSteps"
                [active]="deadEndActive()"
                (activeChange)="deadEndActive.set($event)"
                (done)="deadEndActive.set(false)"
            />

            <ui-tour
                [steps]="asyncSteps"
                [active]="asyncActive()"
                [targetTimeout]="2000"
                (activeChange)="asyncActive.set($event)"
                (done)="asyncActive.set(false)"
                (stepSkipped)="onSkipped($event)"
            />
        </main>
    `,
})
export class TourDemoComponent {
    protected readonly active = signal(false);
    protected readonly asyncActive = signal(false);
    protected readonly deadEndActive = signal(false);
    protected readonly panelOpen = signal(false);
    protected readonly rows = signal<string[]>([]);
    protected readonly skipped = signal<string[]>([]);
    protected readonly slow = signal(false);

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

    /** First step can never resolve — the tour must not offer a Back button to it. */
    protected readonly deadEndSteps: TourStep[] = [
        { target: '[data-testid="never-exists"]', title: 'Dead-end first' },
        { target: '[data-testid="step-one"]', title: 'Dead-end second' },
    ];

    protected readonly asyncSteps: TourStep[] = [
        {
            target: '[data-testid="start-async"]',
            title: 'Async intro',
            description: 'The next step opens a panel first.',
        },
        {
            target: '[data-testid="panel"]',
            title: 'Panel step',
            description: 'Opened by beforeActivate.',
            beforeActivate: async () => {
                if (this.slow()) await new Promise<void>(resolve => setTimeout(resolve, 1500));
                this.panelOpen.set(true);
            },
            afterDeactivate: ({ direction }) => {
                if (direction === 'backward') this.panelOpen.set(false);
            },
        },
        {
            target: '[data-testid="row"]',
            title: 'Row step',
            description: 'Only exists once the list has rows.',
        },
        {
            target: '[data-testid="start-async"]',
            title: 'Async outro',
            description: 'Back where we started.',
        },
    ];

    protected onSkipped(event: TourSkippedEvent): void {
        this.skipped.update(list => [...list, `${event.index}:${event.reason}`]);
    }
}
