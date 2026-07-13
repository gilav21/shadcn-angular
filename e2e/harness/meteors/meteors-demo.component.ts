import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MeteorsComponent } from '@/components/ui/meteors';

/**
 * Auto-generated harness for the `meteors` component.
 * Extend the template and assertions in `meteors.spec.ts` as needed.
 */
@Component({
    selector: 'app-meteors-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MeteorsComponent],
    template: `
        <main class="p-8">
            <ui-meteors data-testid="root"></ui-meteors>
        </main>
    `,
})
export class MeteorsDemoComponent {}
