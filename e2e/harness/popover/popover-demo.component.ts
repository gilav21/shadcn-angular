import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
} from '@/components/ui/popover';

@Component({
    selector: 'app-popover-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        PopoverComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
    ],
    template: `
        <main class="p-8">
            <ui-popover>
                <ui-popover-trigger data-testid="trigger">
                    <button type="button" class="border px-3 py-1 rounded">Open popover</button>
                </ui-popover-trigger>
                <ui-popover-content>
                    <p data-testid="content">Hello popover</p>
                </ui-popover-content>
            </ui-popover>
        </main>
    `,
})
export class PopoverDemoComponent {}
