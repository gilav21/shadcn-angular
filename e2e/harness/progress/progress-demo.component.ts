import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ProgressComponent } from '@/components/ui/progress';

@Component({
    selector: 'app-progress-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ProgressComponent],
    template: `
        <main class="p-8 space-y-4 w-[400px]">
            <ui-progress data-testid="bar" [value]="value()" ariaLabel="Upload" />
            <button type="button" data-testid="bump" (click)="bump()"
                class="border px-3 py-1">
                Advance
            </button>
        </main>
    `,
})
export class ProgressDemoComponent {
    protected readonly value = signal(25);
    protected bump(): void {
        this.value.update(v => Math.min(100, v + 25));
    }
}
