import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhoneInputComponent } from '@/components/ui/phone-input';

/**
 * Auto-generated harness for the `phone-input` component.
 * Extend the template and assertions in `phone-input.spec.ts` as needed.
 */
@Component({
    selector: 'app-phone-input-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PhoneInputComponent],
    template: `
        <main class="p-8">
            <ui-phone-input data-testid="root"></ui-phone-input>
        </main>
    `,
})
export class PhoneInputDemoComponent {}
