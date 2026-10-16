import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    TooltipComponent,
    TooltipTriggerComponent,
    TooltipContentComponent,
} from '@/components/ui/tooltip';

@Component({
    selector: 'app-tooltip-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TooltipComponent,
        TooltipTriggerComponent,
        TooltipContentComponent,
    ],
    template: `
        <main class="p-8">
            <ui-tooltip>
                <ui-tooltip-trigger data-testid="trigger">
                    <button type="button" class="border px-3 py-1 rounded" (click)="tap()">Hover me</button>
                </ui-tooltip-trigger>
                <ui-tooltip-content>
                    <span data-testid="content">Helpful hint</span>
                </ui-tooltip-content>
            </ui-tooltip>
            <p data-testid="taps">{{ taps() }}</p>
        </main>
    `,
})
export class TooltipDemoComponent {
    protected readonly taps = signal(0);
    protected tap(): void {
        this.taps.update(n => n + 1);
    }
}
