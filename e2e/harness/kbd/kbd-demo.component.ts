import { ChangeDetectionStrategy, Component } from '@angular/core';
import { KbdComponent } from '@/components/ui/kbd';

/**
 * Auto-generated harness for the `kbd` component.
 * Extend the template and assertions in `kbd.spec.ts` as needed.
 */
@Component({
    selector: 'app-kbd-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [KbdComponent],
    template: `
        <main class="p-8">
            <ui-kbd data-testid="root"></ui-kbd>
        </main>
    `,
})
export class KbdDemoComponent {}
