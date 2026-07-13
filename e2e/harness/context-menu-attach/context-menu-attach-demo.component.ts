import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
    ContextMenuComponent,
    type ContextMenuItem,
} from '@/components/ui/context-menu';
import {
    ContextMenuAttachDirective,
    type ContextMenuEvent,
} from '@/components/ui/context-menu-attach.directive';

interface Row { readonly id: number; readonly name: string; }

/** Harness for the `context-menu-attach` directive (binds a menu + row data). */
@Component({
    selector: 'app-context-menu-attach-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ContextMenuComponent, ContextMenuAttachDirective],
    template: `
        <main class="p-8">
            <ui-context-menu #menu [items]="items" />

            <ul data-testid="root">
                @for (row of rows; track row.id) {
                    <li
                        class="w-64 border p-2"
                        [attr.data-row]="row.id"
                        [uiContextMenuAttach]="menu"
                        [contextMenuData]="row"
                        (contextMenuTriggered)="onTriggered($event)"
                    >
                        {{ row.name }}
                    </li>
                }
            </ul>
            <p data-testid="target">{{ target() }}</p>
        </main>
    `,
})
export class ContextMenuAttachDemoComponent {
    readonly menu = viewChild.required<ContextMenuComponent>('menu');
    readonly target = signal('');

    readonly rows: Row[] = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
    ];

    readonly items: ContextMenuItem[] = [
        { label: 'Rename' },
        { label: 'Delete' },
    ];

    onTriggered(event: ContextMenuEvent<Row>): void {
        this.target.set(event.item.name);
    }
}
