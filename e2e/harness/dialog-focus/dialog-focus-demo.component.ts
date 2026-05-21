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
 * Focus-trap stress test: a dialog with two focusable controls inside
 * and one focusable control outside. The spec asserts:
 *  - opening the dialog moves focus inside it
 *  - Tab cycles between the inner controls (doesn't escape to outside)
 *  - ESC closes the dialog AND returns focus to the trigger
 *
 * This is the a11y contract every modal must honor — a regression here
 * makes the component unusable with keyboard or screen reader.
 */
@Component({
    selector: 'app-dialog-focus-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DialogComponent, DialogTriggerComponent, DialogContentComponent,
        DialogHeaderComponent, DialogTitleComponent, DialogFooterComponent,
    ],
    template: `
        <main class="p-8 space-y-4">
            <button type="button" data-testid="before" class="border px-3 py-1">Before</button>
            <ui-dialog>
                <ui-dialog-trigger data-testid="trigger">
                    <button type="button" class="border px-3 py-1">Open dialog</button>
                </ui-dialog-trigger>
                <ui-dialog-content>
                    <ui-dialog-header>
                        <ui-dialog-title>Edit profile</ui-dialog-title>
                    </ui-dialog-header>
                    <input type="text" data-testid="dialog-input" class="border px-2 py-1" />
                    <ui-dialog-footer>
                        <button type="button" data-testid="dialog-save" class="border px-3 py-1">Save</button>
                    </ui-dialog-footer>
                </ui-dialog-content>
            </ui-dialog>
            <button type="button" data-testid="after" class="border px-3 py-1">After</button>
        </main>
    `,
})
export class DialogFocusDemoComponent {}
