import {
    Component,
    ChangeDetectionStrategy,
    inject,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { UI_TABLE_ROLE } from '../table.component';

@Component({
    selector: 'ui-table-cell',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    styleUrl: './table-cell.component.css',
    host: {
        class: 'flex items-center flex-shrink-0',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-cell"',
        '[attr.role]': 'role()',
    },
})
export class TableCellComponent {
    private readonly tableRole = inject(UI_TABLE_ROLE, { optional: true });

    /**
     * `gridcell` inside a `grid` or `treegrid`, `cell` inside a plain table.
     *
     * `role="cell"` is not valid in a grid — the two describe different
     * widgets, and assistive tech that sees a grid full of `cell`s cannot
     * navigate it. Taken from the enclosing table so no consumer has to know,
     * and defaulting to `cell` for a cell used outside one.
     */
    readonly role = computed<'cell' | 'gridcell'>(() =>
        this.tableRole?.() === 'table' || !this.tableRole ? 'cell' : 'gridcell',
    );

    /**
     * Extra classes merged onto the cell. Cells are `flex-1` by default, so all
     * columns share the width evenly — set an explicit `w-*`/`basis-*` here (and
     * the same on the matching `ui-table-head`) to size a column. A projected
     * `role="checkbox"` control already gets its padding and alignment trimmed.
     */
    class = input('');

    classes = computed(() => cn(
        'flex-1 [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]',
        this.class()
    ));
}
