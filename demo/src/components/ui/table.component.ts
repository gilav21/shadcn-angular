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
    host: { class: 'contents' },
})
export class TableComponent {
    class = input('');

    classes = computed(() => cn('w-full caption-bottom text-sm', this.class()));
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
    template: `<thead [class]="classes()" [attr.data-slot]="'table-header'"><ng-content /></thead>`,
    host: { class: 'contents' },
})
export class TableHeaderComponent {
    class = input('');

    classes = computed(() => cn('[&_tr]:border-b', this.class()));
}

@Component({
    selector: 'ui-table-body',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<tbody [class]="classes()" [attr.data-slot]="'table-body'"><ng-content /></tbody>`,
    host: { class: 'contents' },
})
export class TableBodyComponent {
    class = input('');

    classes = computed(() => cn('[&_tr:last-child]:border-0', this.class()));
}

@Component({
    selector: 'ui-table-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<tfoot [class]="classes()" [attr.data-slot]="'table-footer'"><ng-content /></tfoot>`,
    host: { class: 'contents' },
})
export class TableFooterComponent {
    class = input('');

    classes = computed(() => cn('bg-muted/50 border-t font-medium [&>tr]:last:border-b-0', this.class()));
}

@Component({
    selector: 'ui-table-row',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<tr [class]="classes()" [attr.data-slot]="'table-row'" [attr.data-state]="selected() ? 'selected' : null"><ng-content /></tr>`,
    host: { class: 'contents' },
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
    template: `<th [class]="classes()" [attr.data-slot]="'table-head'"><ng-content /></th>`,
    host: { class: 'contents' },
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
    template: `<td [class]="classes()" [attr.data-slot]="'table-cell'"><ng-content /></td>`,
    host: { class: 'contents' },
})
export class TableCellComponent {
    class = input('');

    classes = computed(() => cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]',
        this.class()
    ));
}

@Component({
    selector: 'ui-table-caption',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<caption [class]="classes()" [attr.data-slot]="'table-caption'"><ng-content /></caption>`,
    host: { class: 'contents' },
})
export class TableCaptionComponent {
    class = input('');

    classes = computed(() => cn('text-muted-foreground mt-4 text-sm', this.class()));
}
