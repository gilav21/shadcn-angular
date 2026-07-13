import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    SparklesComponent,
    SparklesButtonComponent,
} from '@/components/ui/sparkles';

/**
 * Auto-generated harness for the `sparkles` component.
 * Extend the template and assertions in `sparkles.spec.ts` as needed.
 */
@Component({
    selector: 'app-sparkles-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SparklesComponent, SparklesButtonComponent],
    template: `
        <main class="p-8">
            <ui-sparkles data-testid="root">
                <ui-sparkles-button data-testid="sparkles-button"></ui-sparkles-button>
            </ui-sparkles>
        </main>
    `,
})
export class SparklesDemoComponent {}
