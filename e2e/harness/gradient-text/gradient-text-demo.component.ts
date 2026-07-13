import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GradientTextComponent } from '@/components/ui/gradient-text';

/** Harness for the `gradient-text` component. */
@Component({
    selector: 'app-gradient-text-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [GradientTextComponent],
    template: `
        <main class="p-8">
            <ui-gradient-text data-testid="root" class="block text-4xl">
                Gradient heading
            </ui-gradient-text>
        </main>
    `,
})
export class GradientTextDemoComponent {}
