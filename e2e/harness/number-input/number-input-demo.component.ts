import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NumberInputComponent } from '@/components/ui/number-input';

/**
 * Auto-generated harness for the `number-input` component.
 * Extend the template and assertions in `number-input.spec.ts` as needed.
 */
@Component({
    selector: 'app-number-input-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NumberInputComponent],
    template: `
        <main class="p-8">
            <ui-number-input data-testid="root"></ui-number-input>
        </main>
    `,
})
export class NumberInputDemoComponent {}
