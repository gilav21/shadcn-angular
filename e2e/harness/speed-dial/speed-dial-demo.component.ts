import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    SpeedDialComponent,
    SpeedDialTriggerComponent,
    SpeedDialMenuComponent,
    SpeedDialItemComponent,
} from '@/components/ui/speed-dial';

/** Harness for the `speed-dial` component. */
@Component({
    selector: 'app-speed-dial-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        SpeedDialComponent,
        SpeedDialTriggerComponent,
        SpeedDialMenuComponent,
        SpeedDialItemComponent,
    ],
    template: `
        <main class="flex h-64 items-center justify-center p-8">
            <ui-speed-dial data-testid="root" (visibleChange)="visible.set($event)">
                <ui-speed-dial-trigger data-testid="speed-dial-trigger">
                    <button type="button" class="h-12 w-12 rounded-full border">+</button>
                </ui-speed-dial-trigger>
                <ui-speed-dial-menu data-testid="speed-dial-menu" ariaLabel="Actions">
                    <ui-speed-dial-item data-testid="speed-dial-item">
                        <button type="button" class="h-10 w-10 rounded-full border">A</button>
                    </ui-speed-dial-item>
                    <ui-speed-dial-item data-testid="speed-dial-item-2">
                        <button type="button" class="h-10 w-10 rounded-full border">B</button>
                    </ui-speed-dial-item>
                </ui-speed-dial-menu>
            </ui-speed-dial>
            <p data-testid="visible">{{ visible() ? 'open' : 'closed' }}</p>
        </main>
    `,
})
export class SpeedDialDemoComponent {
    readonly visible = signal(false);
}
