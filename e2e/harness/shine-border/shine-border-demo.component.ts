import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ShineBorderComponent } from '@/components/ui/shine-border';

/**
 * Auto-generated harness for the `shine-border` component.
 * Extend the template and assertions in `shine-border.spec.ts` as needed.
 */
@Component({
    selector: 'app-shine-border-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ShineBorderComponent],
    template: `
        <main class="p-8">
            <ui-shine-border data-testid="root"></ui-shine-border>
        </main>
    `,
})
export class ShineBorderDemoComponent {}
