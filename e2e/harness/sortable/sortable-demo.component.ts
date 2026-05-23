import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    SortableComponent,
    SortableItemComponent,
    SortableItemTemplateDirective,
} from '@/components/ui/sortable';

interface Row {
    id: number;
    name: string;
}

@Component({
    selector: 'app-sortable-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        SortableComponent,
        SortableItemComponent,
        SortableItemTemplateDirective,
    ],
    template: `
        <main class="p-8 space-y-8">
            <section>
                <h2>Single list</h2>
                <ui-sortable [(items)]="rows" data-testid="single">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item
                            [index]="i"
                            class="bg-card border rounded-md px-3 py-2 w-64 block"
                            [attr.data-testid]="'row-' + $any(row).id">
                            {{ $any(row).name }}
                        </ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            </section>

            <section>
                <h2>Cross-list</h2>
                <div class="flex gap-4">
                    <ui-sortable
                        [(items)]="leftCol"
                        group="board"
                        listId="left"
                        class="border rounded-md p-2 min-h-32 w-48"
                        data-testid="left">
                        <ng-template uiSortableItem let-row let-i="index">
                            <ui-sortable-item
                                [index]="i"
                                class="bg-card border rounded-md px-3 py-2 block"
                                [attr.data-testid]="'left-' + $any(row).id">
                                {{ $any(row).name }}
                            </ui-sortable-item>
                        </ng-template>
                    </ui-sortable>
                    <ui-sortable
                        [(items)]="rightCol"
                        group="board"
                        listId="right"
                        class="border rounded-md p-2 min-h-32 w-48"
                        data-testid="right">
                        <ng-template uiSortableItem let-row let-i="index">
                            <ui-sortable-item
                                [index]="i"
                                class="bg-card border rounded-md px-3 py-2 block"
                                [attr.data-testid]="'right-' + $any(row).id">
                                {{ $any(row).name }}
                            </ui-sortable-item>
                        </ng-template>
                    </ui-sortable>
                </div>
            </section>
        </main>
    `,
})
export class SortableDemoComponent {
    readonly rows = signal<Row[]>([
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
        { id: 3, name: 'Gamma' },
    ]);
    readonly leftCol = signal<Row[]>([
        { id: 10, name: 'L1' },
        { id: 11, name: 'L2' },
    ]);
    readonly rightCol = signal<Row[]>([
        { id: 20, name: 'R1' },
    ]);
}
