import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    AlertDialogComponent,
    AlertDialogContentComponent,
} from '@/components/ui/alert-dialog';
import { DatePickerComponent } from '@/components/ui/date-picker';
import {
    DialogComponent,
    DialogTriggerComponent,
    DialogContentComponent,
} from '@/components/ui/dialog';
import { SelectComponent } from '@/components/ui/select';

/**
 * Overlays inside overlays against a real consumer install: a modal form
 * holding a select, a date picker and a nested alert dialog, on a page tall
 * enough to scroll. The spec drives it with the keyboard and the wheel:
 *  - Escape closes exactly the innermost layer, wherever focus is
 *  - Tab and Shift+Tab never leave the open modal
 *  - the page behind a modal does not scroll, and scrolls again once all close
 */
@Component({
    selector: 'app-overlay-stack-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DialogComponent, DialogTriggerComponent, DialogContentComponent,
        AlertDialogComponent, AlertDialogContentComponent,
        SelectComponent, DatePickerComponent,
    ],
    template: `
        <main class="p-8 space-y-4">
            <ui-dialog>
                <ui-dialog-trigger data-testid="open-dialog">
                    <button type="button" class="border px-3 py-1">Edit customer</button>
                </ui-dialog-trigger>
                <ui-dialog-content title="Edit customer">
                    <input type="text" data-testid="name" aria-label="Name" class="border px-2 py-1" />
                    <ui-select [options]="countries" ariaLabel="Country" />
                    <ui-date-picker />
                    <ui-alert-dialog #confirm>
                        <button type="button" data-testid="open-confirm" class="border px-3 py-1" (click)="confirm.show()">
                            Delete customer
                        </button>
                        <ui-alert-dialog-content title="Delete customer?" description="This cannot be undone." />
                    </ui-alert-dialog>
                </ui-dialog-content>
            </ui-dialog>
            <div style="height: 3000px" aria-hidden="true"></div>
        </main>
    `,
})
export class OverlayStackDemoComponent {
    protected readonly countries = ['Netherlands', 'Sweden', 'Japan'];
}
