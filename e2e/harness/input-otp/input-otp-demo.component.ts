import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    InputOTPComponent,
    InputOTPGroupComponent,
    InputOTPSlotComponent,
} from '@/components/ui/input-otp';

/**
 * Note: `ui-input-otp` uses a `model()` named `value`, not ngModel /
 * ControlValueAccessor. Bind with `[(value)]` (or `[value]` +
 * `(valueChange)`) — `[ngModel]` would no-op.
 */
@Component({
    selector: 'app-input-otp-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        InputOTPComponent,
        InputOTPGroupComponent,
        InputOTPSlotComponent,
    ],
    template: `
        <main class="p-8 space-y-4">
            <ui-input-otp
                data-testid="otp"
                [maxLength]="6"
                [value]="value()"
                (valueChange)="value.set($event)"
            >
                <ui-input-otp-group>
                    <ui-input-otp-slot [index]="0" />
                    <ui-input-otp-slot [index]="1" />
                    <ui-input-otp-slot [index]="2" />
                    <ui-input-otp-slot [index]="3" />
                    <ui-input-otp-slot [index]="4" />
                    <ui-input-otp-slot [index]="5" />
                </ui-input-otp-group>
            </ui-input-otp>
            <p data-testid="value">{{ value() }}</p>
        </main>
    `,
})
export class InputOtpDemoComponent {
    protected readonly value = signal('');
}
