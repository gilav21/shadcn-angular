import {
    Component,
    ChangeDetectionStrategy,
    InjectionToken,
    Signal,
    inject,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

/** The ARIA role a `ui-table` declares for itself. */
export type TableRole = 'table' | 'grid' | 'treegrid';

/**
 * The enclosing table's role, published to its descendants.
 *
 * A cell's correct role depends on the table it is in — `cell` in a plain
 * table, `gridcell` in a `grid` or `treegrid` — and that is not something a
 * consumer should have to restate on every cell. The table announces it once
 * and the cells read it.
 */
export const UI_TABLE_ROLE = new InjectionToken<Signal<TableRole>>('UI_TABLE_ROLE');

@Component({
    selector: 'ui-table',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'table'" [attr.role]="role()">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
    providers: [
        { provide: UI_TABLE_ROLE, useFactory: () => inject(TableComponent).role },
    ],
})
export class TableComponent {
    /** Extra classes merged onto the table wrapper. It is a flex column that scrolls horizontally, so give it a bounded height here when the body should scroll rather than the page. */
    class = input('');

    /**
     * ARIA role of the table.
     *
     * `table` is a static, read-only grid of data. Use `grid` when the widget
     * is *interactive* — arrow-key navigation between cells, cell selection,
     * in-place editing — because that is what tells assistive tech to switch
     * out of document reading mode and let the arrow keys through.
     *
     * `treegrid` is `grid` plus hierarchy. Rows that expose `aria-expanded` /
     * `aria-level` — as the data table's sub-rows mode produces — are only
     * valid inside a `treegrid`; on a plain `table` those attributes are
     * ignored by assistive tech, so the hierarchy is lost.
     */
    readonly role = input<TableRole>('table');

    classes = computed(() => cn('flex flex-col w-full min-h-0 overflow-x-auto', this.class()));
}
