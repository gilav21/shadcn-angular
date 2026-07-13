import { ChangeDetectionStrategy, Component } from '@angular/core';
import { InputMaskDirective } from '@/components/ui/input-mask.directive';

/** Harness for the `input-mask` directive. */
@Component({
    selector: 'app-input-mask-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [InputMaskDirective],
    template: `
        <main class="p-8">
            <input
                uiInputMask="(999) 999-9999"
                data-testid="root"
                class="rounded-md border p-2"
            />
        </main>
    `,
})
export class InputMaskDemoComponent {}
