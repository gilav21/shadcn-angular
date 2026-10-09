import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ResultComponent, ResultDetailComponent } from '@/components/ui/result';

/**
 * Verifies that `init --prefix acme` reaches `<ng-content select>` slots, not
 * just selectors and tags. `result` projects `<ui-result-detail>` into a named
 * slot above its actions row; if the CLI left `select="ui-result-detail"`
 * untouched, `<acme-result-detail>` would match nothing and fall into the
 * default slot — inside the actions row, next to the button.
 */
@Component({
    selector: 'app-prefix-projection-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ResultComponent, ResultDetailComponent],
    template: `
        <main class="p-8">
            <acme-result status="success" title="Saved">
                <acme-result-detail data-testid="detail">Order #1042</acme-result-detail>
                <button type="button" data-testid="action">Done</button>
            </acme-result>
        </main>
    `,
})
export class PrefixProjectionDemoComponent {}
