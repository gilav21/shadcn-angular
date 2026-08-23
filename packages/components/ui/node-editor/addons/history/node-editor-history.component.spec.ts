// The run-history panel — `specs/node-editor-addons-spec.md` §5, tasks E2–E5.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import {
    NodeEditorHistoryComponent,
    type RunExportEvent,
} from './node-editor-history.component';
import type { RunNodeRecord, RunRecord } from './node-editor-history.types';
import type { NodeId } from '../..';

function nodeRecord(overrides: Partial<RunNodeRecord> = {}): RunNodeRecord {
    return {
        nodeId: 'a',
        title: 'Text input',
        status: 'done',
        inputs: { url: 'https://example.com' },
        outputs: { value: 'typed' },
        durationMs: 4,
        ...overrides,
    };
}

const RUNS: RunRecord[] = [
    {
        id: 2,
        startedAt: Date.UTC(2026, 0, 1, 12, 0, 30),
        durationMs: 1500,
        status: 'error',
        nodes: [
            nodeRecord(),
            nodeRecord({
                nodeId: 'b',
                title: 'Browser',
                status: 'error',
                error: 'net::ERR_NAME_NOT_RESOLVED',
                outputs: {},
                durationMs: 900,
            }),
        ],
        graph: null,
    },
    {
        id: 1,
        startedAt: Date.UTC(2026, 0, 1, 12, 0, 0),
        durationMs: 6,
        status: 'done',
        nodes: [nodeRecord()],
        graph: null,
    },
];

@Component({
    standalone: true,
    imports: [NodeEditorHistoryComponent],
    template: `
    <ui-node-editor-history
      [runs]="runs()"
      (replayChange)="replayed.set($event)"
      (nodeSelected)="revealed.set($event)"
      (runExported)="exported.set($event)"
      (clearRequested)="cleared.set(cleared() + 1)"
    />
  `,
})
class HostComponent {
    readonly runs = signal<readonly RunRecord[]>(RUNS);
    readonly replayed = signal<RunRecord | null | undefined>(undefined);
    readonly revealed = signal<NodeId | null>(null);
    readonly exported = signal<RunExportEvent | null>(null);
    readonly cleared = signal(0);
}

describe('NodeEditorHistoryComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    function root(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-slot="node-editor-history"]');
    }

    function query<T extends HTMLElement>(slot: string): T | null {
        return fixture.nativeElement.querySelector(`[data-slot="${slot}"]`);
    }

    function all(slot: string): HTMLElement[] {
        return [...fixture.nativeElement.querySelectorAll(`[data-slot="${slot}"]`)];
    }

    function runRows(): HTMLElement[] {
        return all('node-editor-history-run');
    }

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    async function selectRun(id: number): Promise<void> {
        runRows().find(row => row.dataset['run'] === String(id))?.click();
        await settle();
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
    });

    afterEach(() => fixture.destroy());

    describe('the run list', () => {
        it('lists every run', () => {
            expect(runRows()).toHaveLength(2);
        });

        it('keeps the order it was given — newest first', () => {
            expect(runRows().map(row => row.dataset['run'])).toEqual(['2', '1']);
        });

        it('marks a failed run, so it is findable without reading every row', () => {
            expect(runRows()[0].dataset['status']).toBe('error');
        });

        it('says what it has to say before anything has run', async () => {
            host.runs.set([]);
            await settle();

            expect(query('node-editor-history-empty')).not.toBeNull();
            expect(runRows()).toEqual([]);
        });

        it('shows no detail until a run is picked', () => {
            expect(query('node-editor-history-detail')).toBeNull();
        });
    });

    describe('inspecting a run', () => {
        beforeEach(() => selectRun(2));

        it('opens the detail for the run that was picked', () => {
            expect(query('node-editor-history-detail')).not.toBeNull();
        });

        it('marks which row is being inspected', () => {
            expect(runRows()[0].getAttribute('aria-current')).toBe('true');
            expect(runRows()[1].getAttribute('aria-current')).toBeNull();
        });

        it('lists a row per node that ran', () => {
            expect(all('node-editor-history-node').map(row => row.dataset['node'])).toEqual([
                'a',
                'b',
            ]);
        });

        /**
         * The whole reason the record carries values rather than statuses:
         * "what did the browser node actually get" is the question, and a
         * green tick does not answer it.
         */
        it('shows the values each node saw and produced', () => {
            const text = query('node-editor-history-nodes')?.textContent ?? '';
            expect(text).toContain('url: https://example.com');
            expect(text).toContain('value: typed');
        });

        it('shows the error text, not just that there was an error', () => {
            expect(query('node-editor-history-nodes')?.textContent).toContain(
                'net::ERR_NAME_NOT_RESOLVED',
            );
        });

        it('shows how long each node took', () => {
            expect(query('node-editor-history-nodes')?.textContent).toContain('900 ms');
        });

        it('names the slowest node, which is the one worth naming', () => {
            expect(query('node-editor-history-slowest')?.textContent).toContain('Browser');
        });

        it('reveals a node when its name is activated', () => {
            all('node-editor-history-node-reveal')[1].click();
            expect(host.revealed()).toBe('b');
        });
    });

    describe('replay', () => {
        beforeEach(() => selectRun(1));

        it('hands the run over when replay is switched on', () => {
            query<HTMLButtonElement>('node-editor-history-replay')?.click();
            expect(host.replayed()?.id).toBe(1);
        });

        it('hands back null when it is switched off — that IS "back to now"', async () => {
            const button = query<HTMLButtonElement>('node-editor-history-replay');
            button?.click();
            await settle();
            query<HTMLButtonElement>('node-editor-history-replay')?.click();

            expect(host.replayed()).toBeNull();
        });

        it('says which state it is in, rather than leaving it to be inferred', async () => {
            expect(query('node-editor-history-replay')?.getAttribute('aria-pressed')).toBe('false');
            query<HTMLButtonElement>('node-editor-history-replay')?.click();
            await settle();
            expect(query('node-editor-history-replay')?.getAttribute('aria-pressed')).toBe('true');
        });

        /**
         * Picking a different run while replaying must move the replay with
         * it. Otherwise the list says run 2 and the canvas shows run 1 — a
         * disagreement with no way for the user to notice it.
         */
        it('follows the selection while replaying', async () => {
            query<HTMLButtonElement>('node-editor-history-replay')?.click();
            await settle();
            await selectRun(2);

            expect(host.replayed()?.id).toBe(2);
        });

        it('does NOT start replaying just because a row was picked', async () => {
            await selectRun(2);
            expect(host.replayed()).toBeUndefined();
        });
    });

    describe('export', () => {
        beforeEach(() => selectRun(2));

        it('hands over JSON rather than writing a file itself', () => {
            query<HTMLButtonElement>('node-editor-history-export')?.click();

            const exported = host.exported();
            expect(exported?.run.id).toBe(2);
            expect(JSON.parse(exported?.json ?? '{}').nodes).toHaveLength(2);
        });
    });

    describe('clearing', () => {
        it('asks the consumer to clear, since the consumer owns the records', async () => {
            await selectRun(2);
            query<HTMLButtonElement>('node-editor-history-clear')?.click();
            expect(host.cleared()).toBe(1);
        });

        /**
         * Clearing while replaying would leave the editor showing values from
         * a run that no longer exists anywhere.
         */
        it('leaves replay before it does', async () => {
            await selectRun(2);
            query<HTMLButtonElement>('node-editor-history-replay')?.click();
            await settle();
            query<HTMLButtonElement>('node-editor-history-clear')?.click();

            expect(host.replayed()).toBeNull();
        });

        it('closes the detail it was showing', async () => {
            await selectRun(2);
            query<HTMLButtonElement>('node-editor-history-clear')?.click();
            await settle();
            expect(query('node-editor-history-detail')).toBeNull();
        });
    });

    describe('accessibility', () => {
        it('names each run row in words, not in glyphs', () => {
            const label = runRows()[0].getAttribute('aria-label') ?? '';
            expect(label).toContain('Run 2');
            expect(label).toContain('2 nodes');
        });

        it('captions the table, so it is not an unexplained grid', async () => {
            await selectRun(2);
            expect(query('node-editor-history-nodes')?.querySelector('caption')).not.toBeNull();
        });

        it('uses row headers, so a cell is announced with the node it belongs to', async () => {
            await selectRun(2);
            const row = all('node-editor-history-node')[0];
            expect(row.querySelector('th')?.getAttribute('scope')).toBe('row');
        });

        it('has no axe violations with a run open', async () => {
            await selectRun(2);
            const results = await axe.run(root(), { resultTypes: ['violations'] });
            expect(results.violations.map(v => v.id)).toEqual([]);
        });

        it('has no axe violations when empty', async () => {
            host.runs.set([]);
            await settle();
            const results = await axe.run(root(), { resultTypes: ['violations'] });
            expect(results.violations.map(v => v.id)).toEqual([]);
        });
    });
});
