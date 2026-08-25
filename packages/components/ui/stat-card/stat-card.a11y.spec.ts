import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { describe, it, expect } from 'vitest';
import axe from 'axe-core';
import { StatCardComponent } from './index';

/**
 * T-15 — axe clean.
 *
 * These assertions live in the browser suite rather than the Storybook a11y
 * runner because that runner cannot resolve story files from a git worktree
 * under `.claude/worktrees/`: jest builds its `testMatch` with a mixed path
 * separator and matches 0 of 3423 files, every pre-existing story included. The
 * axe engine is the same one the Storybook runner injects, driven here against
 * real Chromium layout, so the check is equivalent and does not depend on that
 * path handling.
 */

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ui-stat-card label="Revenue" value="$45,231" delta="+12.5%" trend="up" />
            <ui-stat-card label="Orders" value="1,210" delta="-3.2%" trend="down" />
            <ui-stat-card label="Sessions" value="18,402" delta="0.0%" />
            <ui-stat-card label="Active users" value="2,350">
                <svg viewBox="0 0 120 32" class="mt-2 h-8 w-full" aria-hidden="true">
                    <path d="M0 26 L60 14 L120 4" fill="none" stroke="currentColor" />
                </svg>
            </ui-stat-card>
        </div>
    `,
    imports: [StatCardComponent],
})
class AxeHostComponent {}

describe('StatCardComponent a11y', () => {
    it('is axe clean across every trend and both content modes', async () => {
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
