import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SeparatorComponent } from '@/components/ui/separator';

/**
 * Auto-generated harness for the `separator` component.
 * Extend the template and assertions in `separator.spec.ts` as needed.
 */
@Component({
    selector: 'app-separator-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SeparatorComponent],
    template: `
        <main class="p-8">
            <ui-separator class="block" data-testid="root"></ui-separator>
        </main>
    `,
})
export class SeparatorDemoComponent {}
