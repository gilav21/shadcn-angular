import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SignaturePadComponent } from '@/components/ui/signature-pad';

/**
 * Harness for the `signature-pad` component, installed the way a consumer
 * installs it.
 *
 * Drawing is the part that only a real browser can prove: pointer capture,
 * canvas rendering and `toDataURL` all behave differently under a test double.
 */
@Component({
    selector: 'app-signature-pad-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SignaturePadComponent],
    template: `
        <main class="space-y-6 p-8">
            <div data-testid="root" style="width: 400px">
                <ui-signature-pad [(value)]="signature" [height]="200" ariaLabel="Signature" />
                <p data-testid="state">{{ signature() ? 'signed' : 'blank' }}</p>
                <p data-testid="length">{{ signature()?.length ?? 0 }}</p>
            </div>

            <div data-testid="bare" style="width: 400px">
                <ui-signature-pad [height]="120" [hideControls]="true" ariaLabel="Bare" />
            </div>
        </main>
    `,
})
export class SignaturePadDemoComponent {
    readonly signature = signal<string | null>(null);
}
