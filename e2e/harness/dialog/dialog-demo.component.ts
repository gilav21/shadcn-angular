import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    DialogComponent,
    DialogTriggerComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogFooterComponent,
} from '@/components/ui/dialog';

/**
 * Native HTML controls inside the dialog. `add dialog` doesn't pull
 * `button`, so the harness avoids ui-button and uses native buttons —
 * exactly what a consumer who installs only `dialog` would have to do.
 */
@Component({
    selector: 'app-dialog-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DialogComponent,
        DialogTriggerComponent,
        DialogContentComponent,
        DialogHeaderComponent,
        DialogTitleComponent,
        DialogFooterComponent,
    ],
    template: `
        <main class="p-8">
            <ui-dialog>
                <ui-dialog-trigger data-testid="trigger">
                    <button type="button" class="border px-3 py-1 rounded">Open dialog</button>
                </ui-dialog-trigger>
                <ui-dialog-content>
                    <ui-dialog-header>
                        <ui-dialog-title data-testid="title">Confirm action</ui-dialog-title>
                    </ui-dialog-header>
                    <ui-dialog-footer>
                        <button type="button" class="border px-3 py-1 rounded">Close</button>
                    </ui-dialog-footer>
                </ui-dialog-content>
            </ui-dialog>
        </main>
    `,
})
export class DialogDemoComponent {}
