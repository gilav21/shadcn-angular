import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    HoverCardComponent,
    HoverCardTriggerComponent,
    HoverCardContentComponent,
} from '@/components/ui/hover-card';

@Component({
    selector: 'app-hover-card-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HoverCardComponent, HoverCardTriggerComponent, HoverCardContentComponent,
    ],
    template: `
        <main class="p-8">
            <ui-hover-card>
                <ui-hover-card-trigger data-testid="trigger">
                    <button type="button" class="border px-3 py-1">@codex</button>
                </ui-hover-card-trigger>
                <ui-hover-card-content>
                    <p data-testid="card-body">Joined May 2024</p>
                </ui-hover-card-content>
            </ui-hover-card>
        </main>
    `,
})
export class HoverCardDemoComponent {}
