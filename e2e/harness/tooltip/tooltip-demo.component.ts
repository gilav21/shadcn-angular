import { ChangeDetectionStrategy, Component } from '@angular/core';
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
                    <button type="button" class="border px-3 py-1 rounded">Hover me</button>
                </ui-tooltip-trigger>
                <ui-tooltip-content>
                    <span data-testid="content">Helpful hint</span>
                </ui-tooltip-content>
            </ui-tooltip>
        </main>
    `,
})
export class TooltipDemoComponent {}
