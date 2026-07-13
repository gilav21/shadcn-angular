import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TypingAnimationComponent } from '@/components/ui/typing-animation';

/**
 * Auto-generated harness for the `typing-animation` component.
 * Extend the template and assertions in `typing-animation.spec.ts` as needed.
 */
@Component({
    selector: 'app-typing-animation-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TypingAnimationComponent],
    template: `
        <main class="p-8">
            <ui-typing-animation data-testid="root"></ui-typing-animation>
        </main>
    `,
})
export class TypingAnimationDemoComponent {}
