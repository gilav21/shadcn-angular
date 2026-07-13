import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TextRevealComponent } from '@/components/ui/text-reveal';

/**
 * Auto-generated harness for the `text-reveal` component.
 * Extend the template and assertions in `text-reveal.spec.ts` as needed.
 */
@Component({
    selector: 'app-text-reveal-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TextRevealComponent],
    template: `
        <main class="p-8">
            <ui-text-reveal data-testid="root"></ui-text-reveal>
        </main>
    `,
})
export class TextRevealDemoComponent {}
