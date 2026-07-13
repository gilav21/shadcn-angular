import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TextareaComponent } from '@/components/ui/textarea';

/**
 * Auto-generated harness for the `textarea` component.
 * Extend the template and assertions in `textarea.spec.ts` as needed.
 */
@Component({
    selector: 'app-textarea-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TextareaComponent],
    template: `
        <main class="p-8">
            <ui-textarea data-testid="root"></ui-textarea>
        </main>
    `,
})
export class TextareaDemoComponent {}
