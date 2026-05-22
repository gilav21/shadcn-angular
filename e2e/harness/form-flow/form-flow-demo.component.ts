import { ChangeDetectionStrategy, Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '@/components/ui/input';
import { LabelComponent } from '@/components/ui/label';
import { ButtonComponent } from '@/components/ui/button';
import {
    DialogComponent,
    DialogTriggerComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogDescriptionComponent,
    DialogFooterComponent,
} from '@/components/ui/dialog';

/**
 * Multi-component install smoke: input + label + button + dialog together
 * in a single template. Verifies the CLI's `add input label button dialog`
 * call resolves all dependencies correctly, copies every needed file, and
 * the result template-compiles when the four are used in one page.
 *
 * Flow: user types a name, clicks "Submit", a confirmation dialog shows
 * the typed value, ESC dismisses it.
 */
@Component({
    selector: 'app-form-flow-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        InputComponent,
        LabelComponent,
        ButtonComponent,
        DialogComponent,
        DialogTriggerComponent,
        DialogContentComponent,
        DialogHeaderComponent,
        DialogTitleComponent,
        DialogDescriptionComponent,
        DialogFooterComponent,
        FormsModule,
    ],
    template: `
        <main class="p-8 space-y-4 w-[400px]">
            <ui-label for="username">Your name</ui-label>
            <ui-input
                elementId="username"
                data-testid="username"
                [ngModel]="username()"
                (ngModelChange)="username.set($event)"
                placeholder="Type your name"
            />
            <ui-dialog>
                <ui-dialog-trigger data-testid="submit">
                    <ui-button [disabled]="!canSubmit()">Submit</ui-button>
                </ui-dialog-trigger>
                <ui-dialog-content>
                    <ui-dialog-header>
                        <ui-dialog-title data-testid="confirm-title">Confirm submission</ui-dialog-title>
                        <ui-dialog-description data-testid="confirm-body">
                            You entered: {{ username() }}
                        </ui-dialog-description>
                    </ui-dialog-header>
                    <ui-dialog-footer>
                        <ui-button variant="outline">Cancel</ui-button>
                    </ui-dialog-footer>
                </ui-dialog-content>
            </ui-dialog>
        </main>
    `,
})
export class FormFlowDemoComponent {
    protected readonly username = signal('');
    protected readonly canSubmit = computed(() => this.username().trim().length > 0);
}
