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
} from '@/components/ui/dialog';
import { CheckboxComponent } from '@/components/ui/checkbox';

/**
 * Accessibility scan target: a small form with the components consumers
 * use 80% of the time (input, label, button, dialog, checkbox). axe-core
 * reports serious / critical issues which we fail the spec on.
 */
@Component({
    selector: 'app-a11y-form-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        InputComponent, LabelComponent, ButtonComponent, CheckboxComponent,
        DialogComponent, DialogTriggerComponent, DialogContentComponent,
        DialogHeaderComponent, DialogTitleComponent, FormsModule,
    ],
    template: `
        <main class="p-8 space-y-4 w-[480px] bg-background text-foreground">
            <h1 class="text-xl font-bold">Sign up</h1>
            <form class="space-y-3">
                <div>
                    <ui-label for="a11y-email">Email</ui-label>
                    <ui-input id="a11y-email" type="email" [ngModel]="email()"
                        (ngModelChange)="email.set($event)" name="email" />
                </div>
                <div>
                    <ui-label for="a11y-pwd">Password</ui-label>
                    <ui-input id="a11y-pwd" type="password" [ngModel]="pwd()"
                        (ngModelChange)="pwd.set($event)" name="password" />
                </div>
                <div class="flex items-center gap-2">
                    <ui-checkbox id="a11y-tos" [checked]="agreed()"
                        (checkedChange)="agreed.set($event)" />
                    <ui-label for="a11y-tos">I agree to the terms</ui-label>
                </div>
                <ui-dialog>
                    <ui-dialog-trigger>
                        <ui-button [disabled]="!canSubmit()" type="button">Sign up</ui-button>
                    </ui-dialog-trigger>
                    <ui-dialog-content>
                        <ui-dialog-header>
                            <ui-dialog-title>Welcome!</ui-dialog-title>
                        </ui-dialog-header>
                    </ui-dialog-content>
                </ui-dialog>
            </form>
        </main>
    `,
})
export class A11yFormDemoComponent {
    protected readonly email = signal('');
    protected readonly pwd = signal('');
    protected readonly agreed = signal(false);
    protected readonly canSubmit = computed(() =>
        this.email().length > 0 && this.pwd().length > 0 && this.agreed(),
    );
}
