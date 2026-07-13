import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ToggleComponent } from '@/components/ui/toggle';

/**
 * Auto-generated harness for the `toggle` component.
 * Extend the template and assertions in `toggle.spec.ts` as needed.
 */
@Component({
    selector: 'app-toggle-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ToggleComponent],
    template: `
        <main class="p-8">
            <ui-toggle data-testid="root"></ui-toggle>
        </main>
    `,
})
export class ToggleDemoComponent {}
