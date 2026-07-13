import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FlipTextComponent } from '@/components/ui/flip-text';

/** Harness for the `flip-text` component. */
@Component({
    selector: 'app-flip-text-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FlipTextComponent],
    template: `
        <main class="p-8">
            <ui-flip-text data-testid="root" class="block" text="Flip me" [delay]="5" [duration]="50" />
        </main>
    `,
})
export class FlipTextDemoComponent {}
