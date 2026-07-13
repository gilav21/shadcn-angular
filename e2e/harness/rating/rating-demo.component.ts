import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RatingComponent } from '@/components/ui/rating';

/**
 * Auto-generated harness for the `rating` component.
 * Extend the template and assertions in `rating.spec.ts` as needed.
 */
@Component({
    selector: 'app-rating-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RatingComponent],
    template: `
        <main class="p-8">
            <ui-rating data-testid="root"></ui-rating>
        </main>
    `,
})
export class RatingDemoComponent {}
