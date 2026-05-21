import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    DrawerComponent,
    DrawerTriggerComponent,
    DrawerContentComponent,
    DrawerHeaderComponent,
    DrawerTitleComponent,
} from '@/components/ui/drawer';

@Component({
    selector: 'app-drawer-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DrawerComponent, DrawerTriggerComponent, DrawerContentComponent,
        DrawerHeaderComponent, DrawerTitleComponent,
    ],
    template: `
        <main class="p-8">
            <ui-drawer>
                <ui-drawer-trigger data-testid="trigger">
                    <button type="button" class="border px-3 py-1">Open drawer</button>
                </ui-drawer-trigger>
                <ui-drawer-content>
                    <ui-drawer-header>
                        <ui-drawer-title data-testid="title">Drawer title</ui-drawer-title>
                    </ui-drawer-header>
                    <p data-testid="body">Drawer body</p>
                </ui-drawer-content>
            </ui-drawer>
        </main>
    `,
})
export class DrawerDemoComponent {}
