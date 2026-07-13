import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
    ContextMenuComponent,
    type ContextMenuItem,
} from '@/components/ui/context-menu';
import { TableContextMenuDirective } from '@/components/ui/table-context-menu.directive';

/** Harness for the `table-context-menu` directive (right-click rows of a table). */
@Component({
    selector: 'app-table-context-menu-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ContextMenuComponent, TableContextMenuDirective],
    template: `
        <main class="p-8">
            <ui-context-menu #menu [items]="items" />

            <table
                data-testid="root"
                [uiTableContextMenu]="menu"
                (rowContextMenu)="row.set($any($event).rowIndex)"
            >
                <tbody>
                    @for (item of rows; track item) {
                        <tr [attr.data-row]="item">
                            <td class="border p-2">{{ item }}</td>
                        </tr>
                    }
                </tbody>
            </table>
            <p data-testid="row">{{ row() }}</p>
        </main>
    `,
})
export class TableContextMenuDemoComponent {
    readonly menu = viewChild.required<ContextMenuComponent>('menu');
    readonly row = signal<number | null>(null);

    readonly rows = ['Alpha', 'Beta'];

    readonly items: ContextMenuItem[] = [{ label: 'Rename' }, { label: 'Delete' }];
}
