import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { describe, it, expect } from 'vitest';
import axe from 'axe-core';
import { ResultComponent, ResultDetailComponent } from './index';
import { ButtonComponent } from '../button';

/**
 * T-15 — axe clean. See `stat-card.a11y.spec.ts` for why these run in the
 * browser suite rather than the Storybook a11y runner.
 */

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div>
            <ui-result status="success" title="Payment received"
                       description="We emailed your receipt.">
                <ui-button>Back to dashboard</ui-button>
                <ui-button variant="outline">View receipt</ui-button>
            </ui-result>

            <ui-result status="error" title="Import failed"
                       description="We could not parse the file you uploaded.">
                <ui-result-detail>
                    <pre>TypeError: nope</pre>
                </ui-result-detail>
                <ui-button>Try again</ui-button>
            </ui-result>

            <ui-result status="warning" title="Partially imported"
                       description="18 of 20 rows were imported." />
            <ui-result status="info" title="Request queued"
                       description="We'll email you when it finishes." />
        </div>
    `,
    imports: [ResultComponent, ResultDetailComponent, ButtonComponent],
})
class AxeHostComponent {}

describe('ResultComponent a11y', () => {
    it('is axe clean across every status, with and without actions', async () => {
        await TestBed.configureTestingModule({
            imports: [AxeHostComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(AxeHostComponent);
        fixture.detectChanges();

        const results = await axe.run(fixture.nativeElement as HTMLElement, {
            resultTypes: ['violations'],
        });

        expect(
            results.violations.flatMap(v =>
                v.nodes.map(n => `${v.id} @ ${n.target.join(' ')} :: ${n.failureSummary}`),
            ),
        ).toEqual([]);
    });
});
