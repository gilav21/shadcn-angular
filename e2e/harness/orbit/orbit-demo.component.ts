import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OrbitComponent } from '@/components/ui/orbit';

/**
 * Auto-generated harness for the `orbit` component.
 * Extend the template and assertions in `orbit.spec.ts` as needed.
 */
@Component({
    selector: 'app-orbit-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [OrbitComponent],
    template: `
        <main class="p-8">
            <ui-orbit data-testid="root"></ui-orbit>
        </main>
    `,
})
export class OrbitDemoComponent {}
