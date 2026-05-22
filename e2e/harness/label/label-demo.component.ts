import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LabelComponent } from '@/components/ui/label';

/**
 * Uses a native <input> on purpose: `add label` only installs the label
 * component, so the harness must not depend on other ui components it
 * wouldn't pull in. Verifying focus association still works against a
 * plain native control is exactly what consumers will do anyway.
 */
@Component({
    selector: 'app-label-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [LabelComponent],
    template: `
        <main class="p-8 space-y-4">
            <ui-label data-testid="label" for="email">Email address</ui-label>
            <input
                data-testid="input"
                id="email"
                type="email"
                placeholder="you@example.com"
                class="border px-2 py-1"
            />
        </main>
    `,
})
export class LabelDemoComponent {}
