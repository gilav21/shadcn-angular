import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonComponent } from '@/components/ui/button';

/**
 * Verifies the `init --prefix acme` flow end-to-end. The CLI rewrites the
 * `button.component.ts` selector from `ui-button` to `acme-button` when it
 * copies the component into the fixture. This harness consumes the result
 * by using `<acme-button>` directly — if the rewrite didn't happen, Angular
 * won't match the tag and the spec will fail.
 */
@Component({
    selector: 'app-prefix-button-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    template: `
        <main class="p-8 space-y-4">
            <acme-button data-testid="primary" (click)="bump()">Click me</acme-button>
            <p data-testid="count">{{ count() }}</p>
        </main>
    `,
})
export class PrefixButtonDemoComponent {
    protected readonly count = signal(0);
    protected bump(): void {
        this.count.update(n => n + 1);
    }
}
