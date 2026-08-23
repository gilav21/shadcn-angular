// Keys belong to whoever is typing.
//
// Reported from real use: "I accidentally hit delete when typing and it
// deleted all my nodes and Ctrl+Z doesn't work." The editor listens for keys
// in the CAPTURE phase on its host, so it ran before the field the caret was
// in ever saw them.
//
// Every existing keyboard test drove the keyboard at the GRAPH. Not one put a
// caret in a field inside a node first, which is why a suite of 9,842 tests
// missed a bug that destroys work in a single keystroke.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NodeEditorComponent } from './node-editor.component';
import {
    NODE_CONTEXT,
    type NodeContext,
    type NodeTypeDefinition,
} from './node-editor.runtime.types';
import type { EditorNode, NodeConnection } from './node-editor.types';

@Component({
    selector: 'test-typing-node',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <input
      data-testid="field"
      [value]="text()"
      (input)="onInput($event)"
    />
  `,
})
class TypingViewComponent {
    private readonly ctx = inject(NODE_CONTEXT) as NodeContext<string>;
    protected readonly text = this.ctx.state;
    protected onInput(event: Event): void {
        this.ctx.setState((event.target as HTMLInputElement).value);
    }
}

const TEXT_INPUT: NodeTypeDefinition<string> = {
    id: 'text-input',
    label: 'Text input',
    ports: [{ id: 'text', direction: 'out', label: 'Text' }],
    initialState: () => 'hello',
    view: TypingViewComponent,
    bodyHeight: 44,
    compute: (_inputs, ctx) => ({ text: ctx.state }),
};

const SINK: NodeTypeDefinition = {
    id: 'sink',
    label: 'Sink',
    ports: [{ id: 'in', direction: 'in', label: 'In' }],
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
    />
  `,
})
class HostComponent {
    readonly definitions = [TEXT_INPUT, SINK];
    readonly nodes = signal<readonly EditorNode[]>([
        { id: 'typing', type: 'text-input', x: 10, y: 10, width: 190, height: 0 },
        { id: 'other', type: 'sink', x: 10, y: 220, width: 190, height: 0 },
    ]);
    readonly connections = signal<readonly NodeConnection[]>([
        { id: 'c1', source: 'typing', sourcePort: 'text', target: 'other', targetPort: 'in' },
    ]);
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

describe('keys pressed while typing belong to the field', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;
    let editor: NodeEditorComponent;

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await nextFrame();
        fixture.detectChanges();
    }

    function field(): HTMLInputElement {
        return fixture.nativeElement.querySelector('[data-testid="field"]');
    }

    /** Dispatched FROM the field, exactly as a real keypress would be. */
    function typeKey(init: KeyboardEventInit): void {
        field().dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, ...init,
        }));
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
        editor = fixture.debugElement.children[0].componentInstance as NodeEditorComponent;
        // Everything selected, so a stray delete would be maximally destructive.
        editor.selection.set({ nodes: ['typing', 'other'], connections: ['c1'] });
        await settle();
    });

    afterEach(() => fixture.destroy());

    it('renders a field inside a node to type in', () => {
        expect(field()).not.toBeNull();
    });

    /**
     * The reported bug, exactly: a caret in a field, a Delete pressed to
     * remove a character, and the whole graph gone.
     */
    it('does NOT delete the graph when Delete is pressed in a field', async () => {
        typeKey({ key: 'Delete' });
        await settle();

        expect(host.nodes()).toHaveLength(2);
        expect(host.connections()).toHaveLength(1);
    });

    it('does not delete the graph on Backspace either', async () => {
        typeKey({ key: 'Backspace' });
        await settle();
        expect(host.nodes()).toHaveLength(2);
    });

    /**
     * Ctrl+Z in a field is the browser's text undo. Taking it meant the graph
     * jumped backwards while the user was trying to fix a typo — which is why
     * undo "worked sometimes": it depended on where the caret was.
     */
    it('leaves Ctrl+Z to the field, so it undoes typing and not the graph', async () => {
        editor.addNode('sink', { x: 300, y: 300 });
        await settle();
        const after = host.nodes().length;

        typeKey({ key: 'z', ctrlKey: true });
        await settle();

        expect(host.nodes()).toHaveLength(after);
    });

    it('leaves Ctrl+A to the field, so it selects text and not every node', async () => {
        editor.selection.set({ nodes: [], connections: [] });
        await settle();

        typeKey({ key: 'a', ctrlKey: true });
        await settle();

        expect(editor.selection().nodes).toEqual([]);
    });

    /**
     * Arrows move the caret. Without the guard they moved the node out from
     * under it, which is disorienting in a way that is hard to even describe
     * as a bug report.
     */
    it('does not move the node when arrow keys move the caret', async () => {
        const before = host.nodes().find(n => n.id === 'typing');

        typeKey({ key: 'ArrowRight', shiftKey: true });
        typeKey({ key: 'ArrowDown' });
        await settle();

        expect(host.nodes().find(n => n.id === 'typing')).toMatchObject({
            x: before?.x ?? 0,
            y: before?.y ?? 0,
        });
    });

    it('does not clear the selection when Escape is pressed in a field', async () => {
        typeKey({ key: 'Escape' });
        await settle();
        expect(editor.selection().nodes).toHaveLength(2);
    });

    describe('the graph still owns its keys everywhere else', () => {
        function pressOnGraph(init: KeyboardEventInit): void {
            const root = fixture.nativeElement.querySelector(
                '[data-slot="node-editor"]',
            ) as HTMLElement;
            root.dispatchEvent(new KeyboardEvent('keydown', {
                bubbles: true, cancelable: true, ...init,
            }));
        }

        it('still deletes the selection when the graph has focus', async () => {
            editor.selection.set({ nodes: ['other'], connections: [] });
            await settle();

            pressOnGraph({ key: 'Delete' });
            await settle();

            expect(host.nodes()).toHaveLength(1);
        });

        it('still undoes when the graph has focus', async () => {
            editor.selection.set({ nodes: ['other'], connections: [] });
            await settle();
            pressOnGraph({ key: 'Delete' });
            await settle();

            pressOnGraph({ key: 'z', ctrlKey: true });
            await settle();

            expect(host.nodes()).toHaveLength(2);
        });

        it('still selects everything with Ctrl+A', async () => {
            editor.selection.set({ nodes: [], connections: [] });
            await settle();

            pressOnGraph({ key: 'a', ctrlKey: true });
            await settle();

            expect(editor.selection().nodes).toHaveLength(2);
        });
    });
});
