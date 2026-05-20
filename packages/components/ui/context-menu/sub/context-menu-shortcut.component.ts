import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-context-menu-shortcut',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'ltr:ml-auto rtl:mr-auto text-xs tracking-widest text-muted-foreground',
        '[attr.data-slot]': '"context-menu-shortcut"',
    },
})
export class ContextMenuShortcutComponent { }
