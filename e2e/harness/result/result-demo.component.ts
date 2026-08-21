import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ResultComponent, ResultDetailComponent } from '@/components/ui/result';

/**
 * Harness for the `result` component.
 *
 * As with `stat-card`, `<ui-result>` is a `display: contents` host, so the
 * assertions in `result.spec.ts` target the rendered panel (`[data-slot="result"]`)
 * rather than the host element.
 */
@Component({
    selector: 'app-result-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ResultComponent, ResultDetailComponent],
    template: `
        <main class="p-8 space-y-8">
            <ui-result
                data-testid="success"
                status="success"
                title="Payment received"
                description="We emailed your receipt."
            >
                <button data-testid="primary">Back to dashboard</button>
                <button data-testid="secondary">View receipt</button>
                <button data-testid="tertiary">Keep shopping</button>
            </ui-result>

            <ui-result
                data-testid="error"
                status="error"
                title="Import failed"
                description="We could not parse the file."
            >
                <ui-result-detail>
                    <pre data-testid="dump">TypeError: nope</pre>
                </ui-result-detail>
                <button data-testid="retry">Try again</button>
            </ui-result>

            <ui-result
                data-testid="bare"
                status="info"
                title="Nothing to do"
                description="Everything is reconciled."
            />
        </main>
    `,
})
export class ResultDemoComponent {}
