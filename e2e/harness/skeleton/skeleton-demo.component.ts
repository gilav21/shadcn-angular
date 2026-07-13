import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SkeletonComponent } from '@/components/ui/skeleton';

/**
 * Auto-generated harness for the `skeleton` component.
 * Extend the template and assertions in `skeleton.spec.ts` as needed.
 */
@Component({
    selector: 'app-skeleton-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SkeletonComponent],
    template: `
        <main class="p-8">
            <ui-skeleton class="block h-8 w-40" data-testid="root"></ui-skeleton>
        </main>
    `,
})
export class SkeletonDemoComponent {}
