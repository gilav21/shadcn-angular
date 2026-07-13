import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WobbleCardComponent } from '@/components/ui/wobble-card';

/** Harness for the `wobble-card` component (tilts toward the pointer). */
@Component({
    selector: 'app-wobble-card-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [WobbleCardComponent],
    template: `
        <main class="p-8">
            <ui-wobble-card data-testid="root" class="block h-48 w-80">
                <p class="p-6">Hover me</p>
            </ui-wobble-card>
        </main>
    `,
})
export class WobbleCardDemoComponent {}
