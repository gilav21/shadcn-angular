import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AspectRatioComponent } from '@/components/ui/aspect-ratio';

/**
 * Auto-generated harness for the `aspect-ratio` component.
 * Extend the template and assertions in `aspect-ratio.spec.ts` as needed.
 */
@Component({
    selector: 'app-aspect-ratio-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AspectRatioComponent],
    template: `
        <main class="p-8">
            <ui-aspect-ratio data-testid="root"></ui-aspect-ratio>
        </main>
    `,
})
export class AspectRatioDemoComponent {}
