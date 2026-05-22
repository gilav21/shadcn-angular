import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EyedropperComponent } from '@/components/ui/eyedropper';

/**
 * Auto-generated harness for the `eyedropper` component.
 * Extend the template and assertions in `eyedropper.spec.ts` as needed.
 */
@Component({
    selector: 'app-eyedropper-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [EyedropperComponent],
    template: `
        <main class="p-8">
            <ui-eyedropper data-testid="root"></ui-eyedropper>
        </main>
    `,
})
export class EyedropperDemoComponent {}
