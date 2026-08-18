import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-table',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'table'" [attr.role]="role()">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class TableComponent {
    /** Extra classes merged onto the table wrapper. It is a flex column that scrolls horizontally, so give it a bounded height here when the body should scroll rather than the page. */
    class = input('');

    /**
     * ARIA role of the grid. Rows that expose `aria-expanded` / `aria-level` —
     * a hierarchical table, as produced by the data table's sub-rows mode — are
     * only valid inside a `treegrid`; on a plain `table` those attributes are
     * ignored by assistive tech, so the hierarchy is lost.
     */
    readonly role = input<'table' | 'treegrid'>('table');

    classes = computed(() => cn('flex flex-col w-full min-h-0 overflow-x-auto', this.class()));
}
