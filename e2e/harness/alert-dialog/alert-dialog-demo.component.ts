import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    AlertDialogComponent,
    AlertDialogTriggerComponent,
    AlertDialogContentComponent,
    AlertDialogHeaderComponent,
    AlertDialogTitleComponent,
    AlertDialogDescriptionComponent,
    AlertDialogFooterComponent,
    AlertDialogActionComponent,
    AlertDialogCancelComponent,
} from '@/components/ui/alert-dialog';

@Component({
    selector: 'app-alert-dialog-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AlertDialogComponent, AlertDialogTriggerComponent,
        AlertDialogContentComponent, AlertDialogHeaderComponent,
        AlertDialogTitleComponent, AlertDialogDescriptionComponent,
        AlertDialogFooterComponent, AlertDialogActionComponent,
        AlertDialogCancelComponent,
    ],
    template: `
        <main class="p-8">
            <ui-alert-dialog>
                <ui-alert-dialog-trigger data-testid="trigger">
                    <button type="button" class="border px-3 py-1">Delete account</button>
                </ui-alert-dialog-trigger>
                <ui-alert-dialog-content>
                    <ui-alert-dialog-header>
                        <ui-alert-dialog-title data-testid="title">
                            Are you absolutely sure?
                        </ui-alert-dialog-title>
                        <ui-alert-dialog-description>
                            This action cannot be undone.
                        </ui-alert-dialog-description>
                    </ui-alert-dialog-header>
                    <ui-alert-dialog-footer>
                        <ui-alert-dialog-cancel data-testid="cancel">
                            Cancel
                        </ui-alert-dialog-cancel>
                        <ui-alert-dialog-action data-testid="confirm"
                            (click)="confirm.set(true)">
                            Continue
                        </ui-alert-dialog-action>
                    </ui-alert-dialog-footer>
                </ui-alert-dialog-content>
            </ui-alert-dialog>
            <p data-testid="confirmed">{{ confirm() ? 'yes' : 'no' }}</p>
        </main>
    `,
})
export class AlertDialogDemoComponent {
    protected readonly confirm = signal(false);
}
