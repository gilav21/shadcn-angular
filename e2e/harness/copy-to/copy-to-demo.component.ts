import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CopyToDirective } from '@/components/ui/directives/copy-to.directive';

/** Harness for the `copy-to` directive (click-to-clipboard). */
@Component({
    selector: 'app-copy-to-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CopyToDirective],
    template: `
        <main class="p-8">
            <button
                type="button"
                data-testid="root"
                class="relative rounded-md border p-2"
                [uiCopyTo]="text"
                (copied)="copied.set(true)"
            >
                Copy the token
            </button>
            <p data-testid="copied">{{ copied() ? 'copied' : 'idle' }}</p>
        </main>
    `,
})
export class CopyToDemoComponent {
    readonly text = 'shadcn-angular';
    readonly copied = signal(false);
}
