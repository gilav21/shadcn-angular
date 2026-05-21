import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    DialogComponent,
    DialogTriggerComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
} from '@/components/ui/dialog';
import {
    DropdownMenuComponent,
    DropdownMenuTriggerComponent,
    DropdownMenuContentComponent,
    DropdownMenuItemComponent,
} from '@/components/ui/dropdown-menu';
import {
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent,
} from '@/components/ui/select';

/**
 * RTL stress test: three overlays inside a dir="rtl" subtree. Verifies
 * each component renders, opens, and reports the correct computed
 * `direction` on its root. Catches CSS regressions where logical
 * properties weren't used (e.g. a hard-coded `left:` instead of `inset-inline-start`).
 */
@Component({
    selector: 'app-rtl-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DialogComponent, DialogTriggerComponent, DialogContentComponent,
        DialogHeaderComponent, DialogTitleComponent,
        DropdownMenuComponent, DropdownMenuTriggerComponent,
        DropdownMenuContentComponent, DropdownMenuItemComponent,
        SelectComponent, SelectTriggerComponent, SelectValueComponent,
        SelectContentComponent, SelectItemComponent,
        FormsModule,
    ],
    template: `
        <main dir="rtl" data-testid="root" class="p-8 space-y-4">
            <ui-dialog>
                <ui-dialog-trigger data-testid="dialog-trigger">
                    <button type="button" class="border px-3 py-1">פתח דיאלוג</button>
                </ui-dialog-trigger>
                <ui-dialog-content>
                    <ui-dialog-header>
                        <ui-dialog-title data-testid="dialog-title">כותרת</ui-dialog-title>
                    </ui-dialog-header>
                </ui-dialog-content>
            </ui-dialog>

            <ui-dropdown-menu>
                <ui-dropdown-menu-trigger data-testid="dropdown-trigger">
                    <button type="button" class="border px-3 py-1">תפריט</button>
                </ui-dropdown-menu-trigger>
                <ui-dropdown-menu-content>
                    <ui-dropdown-menu-item data-testid="dropdown-item">אפשרות</ui-dropdown-menu-item>
                </ui-dropdown-menu-content>
            </ui-dropdown-menu>

            <ui-select>
                <ui-select-trigger data-testid="select-trigger" class="w-[200px]">
                    <ui-select-value placeholder="בחר" />
                </ui-select-trigger>
                <ui-select-content>
                    <ui-select-item value="a" data-testid="select-item">פריט א</ui-select-item>
                </ui-select-content>
            </ui-select>
        </main>
    `,
})
export class RtlDemoComponent {}
