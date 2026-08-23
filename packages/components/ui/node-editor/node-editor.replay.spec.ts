// Replay — the second base gap the run-history addon needed
// (`specs/node-editor-addons-spec.md` §0, §5, task E3).
//
// Node views read their values through NODE_CONTEXT, which only the editor
// supplies, so an addon could not substitute recorded values without forking
// the template. That is the boundary rule saying "base", and these are the
// assertions that it actually works — the same views, the same layout, values
// from a past run.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NodeEditorComponent } from './node-editor.component';
import {
    NODE_CONTEXT,
    type NodeContext,
    type NodeTypeDefinition,
    type ReplayFrame,
} from './node-editor.runtime.types';
import type { EditorNode, NodeConnection } from './node-editor.types';

@Component({
    selector: 'test-shows-value',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<span data-testid="shown">{{ shown() ?? '—' }}</span>`,
})
class ShowsValueComponent {
    private readonly ctx = inject(NODE_CONTEXT) as NodeContext<number>;
    protected readonly shown = this.ctx.input<number>('in');
}

const SOURCE: NodeTypeDefinition = {
    id: 'source',
    label: 'Source',
    ports: [{ id: 'out', direction: 'out', label: 'Out' }],
    initialState: () => 1,
    compute: (_inputs, ctx) => ({ out: ctx.state }),
};

const SHOWS: NodeTypeDefinition = {
    id: 'shows',
    label: 'Shows',
    ports: [{ id: 'in', direction: 'in', label: 'In' }],
    view: ShowsValueComponent,
    bodyHeight: 30,
};

@Component({
    standalone: true,
    imports: [NodeEditorComponent],
    template: `
    <ui-node-editor
      class="h-[400px] w-[400px]"
      [(nodes)]="nodes"
      [(connections)]="connections"
      [definitions]="definitions"
      [replay]="replay()"
    />
  `,
})
class HostComponent {
    readonly definitions = [SOURCE, SHOWS];
    readonly replay = signal<ReplayFrame | null>(null);
    readonly nodes = signal<readonly EditorNode[]>([
        { id: 'a', type: 'source', x: 10, y: 10, width: 170, height: 0 },
        { id: 'b', type: 'shows', x: 10, y: 200, width: 170, height: 0 },
    ]);
    readonly connections = signal<readonly NodeConnection[]>([
        { id: 'c1', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' },
    ]);
}

const PAST: ReplayFrame = {
    a: { status: 'done', inputs: {}, outputs: { out: 99 } },
    b: { status: 'error', inputs: { in: 99 }, outputs: {} },
};

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

describe('replay', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;
    let editor: NodeEditorComponent;

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await nextFrame();
        fixture.detectChanges();
    }

    function shown(): string {
        return (
            fixture.nativeElement.querySelector('[data-testid="shown"]')?.textContent?.trim() ?? ''
        );
    }

    function statusOf(nodeId: string): string | undefined {
        return fixture.nativeElement
            .querySelector(`[data-slot="node-editor-node"][data-node="${nodeId}"]`)
            ?.dataset['status'];
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
        editor = fixture.debugElement.children[0].componentInstance as NodeEditorComponent;
        await settle();
    });

    afterEach(() => fixture.destroy());

    it('shows the live value with no frame bound', () => {
        expect(shown()).toBe('1');
    });

    /**
     * The point of the whole addon. The same view that renders the present
     * renders the past, so there is no second renderer to drift out of step
     * with the first.
     */
    it('shows a past run’s value in the node’s own view', async () => {
        host.replay.set(PAST);
        await settle();
        expect(shown()).toBe('99');
    });

    it('shows the status the node had then, not the one it has now', async () => {
        expect(statusOf('b')).toBe('done');
        host.replay.set(PAST);
        await settle();
        expect(statusOf('b')).toBe('error');
    });

    /**
     * A node that did not run in that pass has no value in it. Reporting the
     * value it happens to hold now would put a present-tense answer inside a
     * picture of the past — the sort of disagreement nobody notices.
     */
    it('reports a node missing from the frame as idle, not as it is now', async () => {
        host.replay.set({ a: { status: 'done', inputs: {}, outputs: { out: 5 } } });
        await settle();
        expect(statusOf('b')).toBe('idle');
    });

    it('returns to the present when the frame is cleared', async () => {
        host.replay.set(PAST);
        await settle();
        host.replay.set(null);
        await settle();
        expect(shown()).toBe('1');
    });

    describe('evaluation is suspended while replaying', () => {
        /**
         * A graph cannot be showing the past and computing the present at the
         * same time. Left running, the live value would overwrite the replayed
         * one the moment anything upstream changed.
         */
        it('does not re-evaluate on a change', async () => {
            host.replay.set(PAST);
            await settle();

            editor.runtime.setState('a', 42);
            await settle();

            expect(shown()).toBe('99');
        });

        it('catches up once the frame is cleared', async () => {
            host.replay.set(PAST);
            await settle();
            editor.runtime.setState('a', 42);
            await settle();

            // No explicit run(): clearing the frame is itself a change the
            // editor's effect sees, so the graph resumes on its own.
            host.replay.set(null);
            await settle();

            expect(shown()).toBe('42');
        });

        it('still evaluates when explicitly run', async () => {
            host.replay.set(PAST);
            await settle();
            editor.runtime.setState('a', 7);
            await editor.run();

            // The runtime did the work; the view keeps showing the past,
            // because that is what the bound frame says.
            expect(editor.runtime.outputs('a')()).toEqual({ out: 7 });
            await settle();
            expect(shown()).toBe('99');
        });
    });
});
