// The problems panel addon — `specs/node-editor-addons-spec.md` §1.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { NodeEditorProblemsComponent } from './node-editor-problems.component';
import type { GraphProblem } from '../..';

const PROBLEMS: GraphProblem[] = [
    {
        kind: 'required-input-unconnected',
        nodeId: 'lookup',
        portId: 'key',
        message: '“Lookup” needs “Key” connected.',
        severity: 'error',
    },
    {
        kind: 'unknown-type',
        nodeId: 'mystery',
        message: '“Mystery” has type “foo”, which is not registered.',
        severity: 'warning',
    },
    {
        kind: 'cycle',
        nodeId: 'filter',
        message: '“Filter” is part of a loop, so it cannot run.',
        severity: 'error',
    },
];

@Component({
    standalone: true,
    imports: [NodeEditorProblemsComponent],
    template: `
    <ui-node-editor-problems
      [problems]="problems()"
      (problemSelected)="selected.set($event)"
    />
  `,
})
class HostComponent {
    readonly problems = signal<readonly GraphProblem[]>(PROBLEMS);
    readonly selected = signal<GraphProblem | null>(null);
}

describe('NodeEditorProblemsComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;
    let root: HTMLElement;

    function rows(): HTMLElement[] {
        return [...root.querySelectorAll<HTMLElement>('[data-slot="node-editor-problem"]')];
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
        root = fixture.nativeElement.querySelector('[data-slot="node-editor-problems"]') as HTMLElement;
    });

    afterEach(() => fixture.destroy());

    describe('it lists what is wrong, in words', () => {
        it('renders one row per problem', () => {
            expect(rows()).toHaveLength(3);
        });

        it('shows the runtime’s message verbatim, never the code', () => {
            const text = root.textContent ?? '';
            expect(text).toContain('needs “Key” connected');
            expect(text).not.toContain('required-input-unconnected');
            expect(text).not.toContain('unknown-type');
        });

        it('puts errors before warnings', () => {
            const severities = rows().map(row => row.dataset['severity']);
            expect(severities).toEqual(['error', 'error', 'warning']);
        });

        it('keeps the runtime’s order within a severity', () => {
            // 'lookup' came before 'filter' in the input; both are errors.
            expect(rows().slice(0, 2).map(r => r.dataset['node'])).toEqual(['lookup', 'filter']);
        });
    });

    describe('empty state', () => {
        it('says the graph is valid rather than showing an empty box', async () => {
            host.problems.set([]);
            fixture.detectChanges();
            await fixture.whenStable();

            expect(rows()).toHaveLength(0);
            expect(root.querySelector('[data-slot="node-editor-problems-empty"]')?.textContent)
                .toContain('No problems');
        });
    });

    describe('selecting a problem', () => {
        it('emits the problem so the consumer can reveal its node', () => {
            rows()[0].click();
            expect(host.selected()?.nodeId).toBe('lookup');
        });

        /**
         * Each row is a real button. A div with a click handler would leave the
         * panel usable with a pointer only — and this panel exists to explain
         * things, which is exactly what a keyboard user needs most.
         */
        it('uses buttons, so every row is keyboard reachable', () => {
            expect(rows().every(row => row.tagName === 'BUTTON')).toBe(true);
        });

        it('names the severity and the action in the accessible label', () => {
            const label = rows()[0].getAttribute('aria-label') ?? '';
            expect(label).toContain('Error');
            expect(label).toContain('Show this node');
        });
    });

    describe('announcements', () => {
        it('announces politely, not assertively', () => {
            // Problems appear WHILE editing; interrupting mid-action to say an
            // input is still unconnected is worse than waiting for a pause.
            const live = root.querySelector('[role="status"]');
            expect(live?.getAttribute('aria-live')).toBe('polite');
        });

        it('summarises the count for a screen reader', () => {
            expect(root.querySelector('[role="status"]')?.textContent).toContain('3');
        });
    });

    describe('the panel adapts to where it sits', () => {
        it('can drop its heading when it already sits under one', async () => {
            const solo = TestBed.createComponent(NodeEditorProblemsComponent);
            solo.componentRef.setInput('problems', PROBLEMS);
            solo.componentRef.setInput('heading', false);
            solo.detectChanges();

            const el = solo.nativeElement as HTMLElement;
            expect(el.querySelector('[data-slot="node-editor-problems-heading"]')).toBeNull();
            solo.destroy();
        });
    });

    describe('accessibility', () => {
        it('has no axe violations with problems listed', async () => {
            const results = await axe.run(root, { resultTypes: ['violations'] });
            expect(results.violations.map(v => v.id)).toEqual([]);
        });

        it('has no axe violations when empty', async () => {
            host.problems.set([]);
            fixture.detectChanges();
            await fixture.whenStable();

            const results = await axe.run(root, { resultTypes: ['violations'] });
            expect(results.violations.map(v => v.id)).toEqual([]);
        });
    });
});
