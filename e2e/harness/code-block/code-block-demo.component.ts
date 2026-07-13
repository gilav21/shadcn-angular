import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CodeBlockComponent } from '@/components/ui/code-block';

/**
 * Auto-generated harness for the `code-block` component.
 * Extend the template and assertions in `code-block.spec.ts` as needed.
 */
@Component({
    selector: 'app-code-block-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CodeBlockComponent],
    template: `
        <main class="p-8">
            <ui-code-block data-testid="root"></ui-code-block>
        </main>
    `,
})
export class CodeBlockDemoComponent {}
