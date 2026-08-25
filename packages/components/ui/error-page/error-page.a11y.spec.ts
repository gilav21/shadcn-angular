import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { describe, it, expect } from 'vitest';
import axe from 'axe-core';
import {
    ErrorPageActionsComponent,
    ErrorPageComponent,
    ErrorPageIllustrationComponent,
} from './index';
import { ButtonComponent } from '../button';

/**
 * T-15 — axe clean. See `stat-card.a11y.spec.ts` for why these run in the
 * browser suite rather than the Storybook a11y runner.
 *
 * Each case is audited on its own, because an error-page owns a real `<h1>` by
 * design (UC-14) and stacking several into one fixture would test a document
 * shape no consumer produces.
 */

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ui-error-page code="404" />`,
    imports: [ErrorPageComponent],
})
class DefaultHostComponent {}

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ui-error-page code="500">
            <ui-error-page-illustration>
                <svg viewBox="0 0 60 40" class="h-20 w-auto" aria-hidden="true">
                    <rect x="5" y="5" width="50" height="30" fill="none" stroke="currentColor" />
                </svg>
            </ui-error-page-illustration>
            <ui-error-page-actions>
                <ui-button>Try again</ui-button>
            </ui-error-page-actions>
        </ui-error-page>
    `,
    imports: [
        ErrorPageComponent,
        ErrorPageIllustrationComponent,
        ErrorPageActionsComponent,
        ButtonComponent,
    ],
})
class ProjectedHostComponent {}

async function violationsFor(component: unknown): Promise<string[]> {
    await TestBed.configureTestingModule({
        imports: [component as never],
    }).compileComponents();
    const fixture = TestBed.createComponent(component as never);
    fixture.detectChanges();

    const results = await axe.run(fixture.nativeElement as HTMLElement, {
        resultTypes: ['violations'],
    });
    return results.violations.flatMap(v =>
        v.nodes.map(n => `${v.id} @ ${n.target.join(' ')} :: ${n.failureSummary}`),
    );
}

describe('ErrorPageComponent a11y', () => {
    it('is axe clean with the default illustration and actions', async () => {
        expect(await violationsFor(DefaultHostComponent)).toEqual([]);
    });

    it('is axe clean with a projected illustration and actions', async () => {
        expect(await violationsFor(ProjectedHostComponent)).toEqual([]);
    });
});
