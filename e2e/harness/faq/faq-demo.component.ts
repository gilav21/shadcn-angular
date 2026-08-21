import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FaqBlockComponent } from '@/blocks/faq';

/** Harness for the `faq` block. */
@Component({
    selector: 'app-faq-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FaqBlockComponent],
    template: `
        <main class="p-8">
            <ui-faq-block data-testid="root" />
        </main>
    `,
})
export class FaqDemoComponent {}
