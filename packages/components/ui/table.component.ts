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
    <div [class]="classes()" [attr.data-slot]="'table'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class TableComponent {
    class = input('');

    classes = computed(() => cn('flex flex-col w-full min-h-0', this.class()));
}

@Directive({
    selector: 'thead[uiTableHeader], ui-table-header',
})
export class TableHeaderDirective {
    class = input('');

    classes = computed(() => cn('', this.class()));
}

@Component({
    selector: 'ui-table-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'sticky top-0 z-20 bg-background flex-shrink-0',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-header"',
        'role': 'rowgroup'
    },
})
export class TableHeaderComponent {
    class = input('');

    classes = computed(() => cn('', this.class()));
}

@Component({
    selector: 'ui-table-body',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col flex-1',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-body"',
        'role': 'rowgroup'
    },
})
export class TableBodyComponent {
    class = input('');

    classes = computed(() => cn('', this.class()));
}

@Component({
    selector: 'ui-table-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col flex-shrink-0 bg-muted/50 border-t font-medium',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-footer"',
        'role': 'rowgroup'
    },
})
export class TableFooterComponent {
    class = input('');

    classes = computed(() => cn('', this.class()));
}

@Component({
    selector: 'ui-table-row',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex w-full min-w-max flex-shrink-0',
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
        'hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors',
        this.class()
    ));
}

@Component({
    selector: 'ui-table-head',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex items-center flex-shrink-0',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-head"',
        'role': 'columnheader'
    },
})
export class TableHeadComponent {
    class = input('');

    classes = computed(() => cn(
        'text-foreground h-10 px-2 ltr:text-left rtl:text-right font-medium whitespace-nowrap overflow-hidden text-ellipsis [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]',
        this.class()
    ));
}

@Component({
    selector: 'ui-table-cell',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex items-center flex-shrink-0',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-cell"',
        'role': 'cell'
    },
})
export class TableCellComponent {
    class = input('');

    classes = computed(() => cn(
        'p-2 whitespace-nowrap overflow-hidden text-ellipsis border-r [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]',
        this.class()
    ));
}

@Component({
    selector: 'ui-table-caption',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-caption"'
    },
})
export class TableCaptionComponent {
    class = input('');

    classes = computed(() => cn('text-muted-foreground mt-4 text-sm', this.class()));
}
