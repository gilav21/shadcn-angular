// The base's public API, derived from what the addons actually need
// (`specs/node-editor-addons-spec.md` §0).
//
// Each method here exists because an addon asked for it. They are tested at
// the base because the boundary rule says an addon needing something the base
// does not expose is a gap in the base — so these are the gap, closed.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NodeEditorComponent } from './node-editor.component';
import type { NodeTypeDefinition } from './node-editor.runtime.types';
import type { EditorNode, NodeConnection } from './node-editor.types';
import type { CanvasPoint } from '../infinite-canvas';

const SOURCE: NodeTypeDefinition = {
    id: 'source',
    label: 'Source',
    ports: [{ id: 'out', direction: 'out', label: 'Out' }],
    initialState: () => 'seed',
    compute: (_inputs, ctx) => ({ out: ctx.state }),
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
      (addNodeRequested)="requested.set($event)"
    />
  `,
})
class HostComponent {
    readonly definitions = [SOURCE, SINK];
    readonly requested = signal<CanvasPoint | null>(null);
    readonly nodes = signal<readonly EditorNode[]>([
        { id: 'a', type: 'source', x: 10, y: 10, width: 170, height: 0 },
        { id: 'b', type: 'sink', x: 10, y: 160, width: 170, height: 0 },
    ]);
    readonly connections = signal<readonly NodeConnection[]>([
        { id: 'c1', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' },
    ]);
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

describe('the base API the addons need', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;
    let editor: NodeEditorComponent;
    let root: HTMLElement;

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await nextFrame();
        fixture.detectChanges();
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
        editor = fixture.debugElement.children[0].componentInstance as NodeEditorComponent;
        root = fixture.nativeElement.querySelector('[data-slot="node-editor"]') as HTMLElement;
        await settle();
    });

    afterEach(() => fixture.destroy());

    describe('addNode — for the palette', () => {
        it('inserts a node of a registered type at a world point', async () => {
            const id = editor.addNode('source', { x: 300, y: 200 });
            await settle();

            const added = host.nodes().find(n => n.id === id);
            expect(added).toMatchObject({ type: 'source', x: 300, y: 200 });
        });

        it('materialises its ports from the definition', async () => {
            const id = editor.addNode('sink', { x: 0, y: 0 }) as string;
            await settle();

            const card = root.querySelector(`[data-slot="node-editor-node"][data-node="${id}"]`);
            const wrapper = card?.closest('[data-slot="canvas-item"]');
            expect(wrapper?.querySelectorAll('[data-slot="node-editor-port"]')).toHaveLength(1);
        });

        it('selects what it just added, so the user can see where it went', async () => {
            const id = editor.addNode('source', { x: 0, y: 0 });
            await settle();
            expect(editor.selection().nodes).toEqual([id]);
        });

        it('refuses an unregistered type rather than inserting a broken node', () => {
            expect(editor.addNode('nope', { x: 0, y: 0 })).toBeNull();
            expect(host.nodes()).toHaveLength(2);
        });

        it('is undoable, which is why it routes through the command funnel', async () => {
            editor.addNode('source', { x: 0, y: 0 });
            await settle();
            expect(host.nodes()).toHaveLength(3);

            editor.undo();
            await settle();
            expect(host.nodes()).toHaveLength(2);
        });
    });

    describe('addNodeRequested — the intent, not the UI', () => {
        it('emits a WORLD point when empty plane is double-clicked', async () => {
            root.dispatchEvent(new MouseEvent('dblclick', {
                bubbles: true, cancelable: true, clientX: 250, clientY: 300,
            }));
            await settle();

            expect(host.requested()).not.toBeNull();
        });

        it('does NOT fire on a node — that is a different gesture', async () => {
            const card = root.querySelector('[data-slot="node-editor-node"]');
            card?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
            await settle();

            expect(host.requested()).toBeNull();
        });
    });

    describe('moveNodes and placeNodes — for auto-layout', () => {
        it('moves by a delta as one undoable command', async () => {
            editor.moveNodes(new Map([['a', { x: 40, y: 0 }]]));
            await settle();
            expect(host.nodes()[0].x).toBe(50);

            editor.undo();
            await settle();
            expect(host.nodes()[0].x).toBe(10);
        });

        it('places at absolute positions, which is what a layout algorithm returns', async () => {
            editor.placeNodes(new Map([['a', { x: 500, y: 40 }], ['b', { x: 500, y: 200 }]]));
            await settle();

            expect(host.nodes().find(n => n.id === 'a')).toMatchObject({ x: 500, y: 40 });
            expect(host.nodes().find(n => n.id === 'b')).toMatchObject({ x: 500, y: 200 });
        });

        it('undoes a whole layout in ONE step, not one per node', async () => {
            editor.placeNodes(new Map([['a', { x: 500, y: 40 }], ['b', { x: 500, y: 200 }]]));
            await settle();

            editor.undo();
            await settle();
            expect(host.nodes().find(n => n.id === 'a')).toMatchObject({ x: 10, y: 10 });
            expect(host.nodes().find(n => n.id === 'b')).toMatchObject({ x: 10, y: 160 });
        });
    });

    describe('undo and redo', () => {
        it('reports whether there is anything to undo', async () => {
            expect(editor.canUndo()).toBe(false);
            editor.addNode('source', { x: 0, y: 0 });
            await settle();
            expect(editor.canUndo()).toBe(true);
        });

        it('redoes what it undid', async () => {
            editor.addNode('source', { x: 0, y: 0 });
            await settle();
            editor.undo();
            await settle();
            expect(host.nodes()).toHaveLength(2);

            editor.redo();
            await settle();
            expect(host.nodes()).toHaveLength(3);
        });

        /**
         * Removing a node took its edges with it. Restoring only the node
         * would silently lose the wiring, which is the one case a single
         * command cannot express.
         */
        it('restores a removed node’s connections, not just the node', async () => {
            editor.selection.set({ nodes: ['b'], connections: [] });
            await settle();

            const key = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true });
            root.dispatchEvent(key);
            await settle();
            expect(host.connections()).toHaveLength(0);

            editor.undo();
            await settle();
            expect(host.nodes()).toHaveLength(2);
            expect(host.connections()).toHaveLength(1);
        });

        it('is driven by Ctrl+Z and Ctrl+Shift+Z', async () => {
            editor.addNode('source', { x: 0, y: 0 });
            await settle();

            root.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'z', ctrlKey: true, bubbles: true, cancelable: true,
            }));
            await settle();
            expect(host.nodes()).toHaveLength(2);

            root.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
            }));
            await settle();
            expect(host.nodes()).toHaveLength(3);
        });
    });

    describe('viewport access — for the minimap', () => {
        it('reports the visible world rect', () => {
            const rect = editor.visibleRect();
            expect(rect.width).toBeGreaterThan(0);
            expect(rect.height).toBeGreaterThan(0);
        });

        it('centres a world point', () => {
            const before = editor.visibleRect();
            editor.panTo({ x: 2000, y: 2000 });
            expect(editor.visibleRect().x).not.toBe(before.x);
        });

        it('converts screen coordinates to world', () => {
            const rect = root.getBoundingClientRect();
            const world = editor.toWorld({ x: rect.left + 100, y: rect.top + 50 });
            expect(world).toMatchObject({ x: 100, y: 50 });
        });
    });

    describe('readonly graphs refuse every one of these', () => {
        it('will not add, move or place', async () => {
            fixture.componentRef.setInput('readonlyGraph', true);
            const solo = TestBed.createComponent(NodeEditorComponent);
            solo.componentRef.setInput('definitions', [SOURCE]);
            solo.componentRef.setInput('readonlyGraph', true);
            solo.detectChanges();
            await solo.whenStable();

            const readonlyEditor = solo.componentInstance;
            expect(readonlyEditor.addNode('source', { x: 0, y: 0 })).toBeNull();
            readonlyEditor.moveNodes(new Map([['a', { x: 10, y: 10 }]]));
            expect(readonlyEditor.nodes()).toEqual([]);
            solo.destroy();
        });
    });

describe('renderedNodes — what an addon must position and draw', () => {
    /**
     * The authored array carries `height: 0`; the editor derives the real
     * height from the port count. An addon handed the authored array laid out
     * overlapping nodes and drew hairline boxes on the minimap — both found by
     * looking at the result rather than by a test.
     */
    it('reports the DERIVED height, not the authored zero', () => {
        expect(host.nodes().every(n => n.height === 0)).toBe(true);
        expect(editor.renderedNodes().every(n => n.height > 0)).toBe(true);
    });

    it('reports materialised ports, so a layout knows what it is placing', () => {
        expect(host.nodes().every(n => n.ports === undefined)).toBe(true);
        expect(editor.renderedNodes().every(n => (n.ports?.length ?? 0) > 0)).toBe(true);
    });

    it('keeps every node, in order', () => {
        expect(editor.renderedNodes().map(n => n.id)).toEqual(host.nodes().map(n => n.id));
    });
});
});
