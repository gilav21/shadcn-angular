import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ParticlesComponent } from '@/components/ui/particles';

/**
 * Auto-generated harness for the `particles` component.
 * Extend the template and assertions in `particles.spec.ts` as needed.
 */
@Component({
    selector: 'app-particles-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ParticlesComponent],
    template: `
        <main class="p-8">
            <ui-particles data-testid="root"></ui-particles>
        </main>
    `,
})
export class ParticlesDemoComponent {}
