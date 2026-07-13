import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UiMagneticDirective } from '@/components/ui/magnetic.directive';

/** Harness for the `magnetic` directive (pulls the element toward the cursor). */
@Component({
    selector: 'app-magnetic-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [UiMagneticDirective],
    template: `
        <main class="flex h-96 items-center justify-center p-8">
            <button
                type="button"
                uiMagnetic
                data-testid="root"
                class="h-16 w-40 rounded-md border"
            >
                Magnetic
            </button>
        </main>
    `,
})
export class MagneticDemoComponent {}
