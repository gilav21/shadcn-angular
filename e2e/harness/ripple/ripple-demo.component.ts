import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UiRippleDirective } from '@/components/ui/ripple.directive';

/** Harness for the `ripple` directive. */
@Component({
    selector: 'app-ripple-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [UiRippleDirective],
    template: `
        <main class="p-8">
            <button
                type="button"
                uiRipple
                data-testid="root"
                class="relative h-12 w-40 overflow-hidden rounded-md border"
            >
                Click me
            </button>
        </main>
    `,
})
export class RippleDemoComponent {}
