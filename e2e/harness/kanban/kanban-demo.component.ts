import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    KanbanComponent,
    KanbanColumnHeaderComponent,
    KanbanCardContentComponent,
    KanbanCardComponent,
    KanbanCardDialogComponent,
    KanbanColumnDialogComponent,
    KanbanDeleteColumnDialogComponent,
    KanbanColumnComponent,
} from '@/components/ui/kanban';

/**
 * Auto-generated harness for the `kanban` component.
 * Extend the template and assertions in `kanban.spec.ts` as needed.
 */
@Component({
    selector: 'app-kanban-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [KanbanComponent, KanbanColumnHeaderComponent, KanbanCardContentComponent, KanbanCardComponent, KanbanCardDialogComponent, KanbanColumnDialogComponent, KanbanDeleteColumnDialogComponent, KanbanColumnComponent],
    template: `
        <main class="p-8">
            <ui-kanban data-testid="root">
                <ui-kanban-column-header data-testid="kanban-column-header"></ui-kanban-column-header>
                <ui-kanban-card-content data-testid="kanban-card-content"></ui-kanban-card-content>
                <ui-kanban-card data-testid="kanban-card"></ui-kanban-card>
                <ui-kanban-card-dialog data-testid="kanban-card-dialog"></ui-kanban-card-dialog>
                <ui-kanban-column-dialog data-testid="kanban-column-dialog"></ui-kanban-column-dialog>
                <ui-kanban-delete-column-dialog data-testid="kanban-delete-column-dialog"></ui-kanban-delete-column-dialog>
                <ui-kanban-column data-testid="kanban-column"></ui-kanban-column>
            </ui-kanban>
        </main>
    `,
})
export class KanbanDemoComponent {}
