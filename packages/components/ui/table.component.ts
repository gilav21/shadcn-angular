import {
    Component,
    Directive,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-table',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div data-slot="table-container" class="relative w-full overflow-x-auto">
      <table [class]="classes()" [attr.data-slot]="'table'">
        <ng-content />
      </table>
    </div>
  `,
    host: { class: 'contents' }, // ui-table wrapper can stay contents or block, but it wraps a div+table. contents is fine here as it disappears.
})
export class TableComponent {
    class = input('');

    classes = computed(() => cn('w-full caption-bottom text-sm border-collapse', this.class()));
}

@Directive({
    selector: 'thead[uiTableHeader], ui-table-header',
})
export class TableHeaderDirective {
    class = input('');

    classes = computed(() => cn('[&_tr]:border-b', this.class()));
}

@Component({
    selector: 'ui-table-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'table-header-group',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-header"',
        'role': 'rowgroup'
    },
})
export class TableHeaderComponent {
    class = input('');

    classes = computed(() => cn('[&_tr]:border-b', this.class()));
}

@Component({
    selector: 'ui-table-body',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'table-row-group',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-body"',
        'role': 'rowgroup'
    },
})
export class TableBodyComponent {
    class = input('');

    classes = computed(() => cn('[&_tr:last-child]:border-0', this.class()));
}

@Component({
    selector: 'ui-table-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'table-footer-group',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-footer"',
        'role': 'rowgroup'
    },
})
export class TableFooterComponent {
    class = input('');

    classes = computed(() => cn('bg-muted/50 border-t font-medium [&>tr]:last:border-b-0', this.class()));
}

@Component({
    selector: 'ui-table-row',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'table-row',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-row"',
        '[attr.data-state]': 'selected() ? "selected" : null',
        'role': 'row'
    },
})
export class TableRowComponent {
    class = input('');
    selected = input(false);

    classes = computed(() => cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        this.class()
    ));
}

@Component({
    selector: 'ui-table-head',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'table-cell',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-head"',
        'role': 'columnheader'
    },
})
export class TableHeadComponent {
    class = input('');

    classes = computed(() => cn(
        'text-foreground h-10 px-2 ltr:text-left rtl:text-right align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]',
        this.class()
    ));
}

@Component({
    selector: 'ui-table-cell',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'table-cell',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-cell"',
        'role': 'cell'
    },
})
export class TableCellComponent {
    class = input('');

    classes = computed(() => cn(
        'p-2 align-middle whitespace-nowrap border-r [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]',
        this.class()
    ));
}

@Component({
    selector: 'ui-table-caption',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'table-caption',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-caption"'
    },
})
export class TableCaptionComponent {
    class = input('');

    classes = computed(() => cn('text-muted-foreground mt-4 text-sm', this.class()));
}
