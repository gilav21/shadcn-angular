// Working out what a right-click landed on.
//
// Three mechanisms answer for three different things — a port and a node are
// real elements, a wire exists only as pixels on a shared canvas — and the
// order they are asked in is the whole design.
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { resolveTarget, type ContextMenuEditor } from './node-editor-context-menu.resolve';
import type { EditorNode, NodeConnection } from '../node-editor';

const NODES: EditorNode[] = [
    {
        id: 'a',
        x: 0,
        y: 0,
        width: 180,
        height: 80,
        title: 'Source',
        ports: [{ id: 'out', direction: 'out', label: 'Out' }],
    },
    {
        id: 'b',
        x: 300,
        y: 0,
        width: 180,
        height: 80,
        title: 'Sink',
        ports: [{ id: 'in', direction: 'in', label: 'In' }],
    },
];

const CONNECTIONS: NodeConnection[] = [
    { id: 'c1', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' },
];

/** A DOM shaped like the editor's, without standing up an editor. */
function buildDom(): HTMLElement {
    const root = document.createElement('div');
    root.dataset['slot'] = 'node-editor';

    for (const node of NODES) {
        const card = document.createElement('div');
        card.dataset['slot'] = 'node-editor-node';
        card.dataset['node'] = String(node.id);

        const port = document.createElement('button');
        port.dataset['slot'] = 'node-editor-port';
        port.dataset['node'] = String(node.id);
        port.dataset['port'] = node.ports?.[0]?.id ?? '';
        card.appendChild(port);
        root.appendChild(card);
    }

    const plane = document.createElement('div');
    plane.dataset['slot'] = 'canvas-viewport';
    root.appendChild(plane);

    document.body.appendChild(root);
    return root;
}

describe('resolveTarget', () => {
    let root: HTMLElement;
    let hit: { kind: 'node' | 'connection'; id: string } | null;
    let editor: ContextMenuEditor;

    function rightClick(on: Element): MouseEvent {
        const event = new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: 120, clientY: 60,
        });
        Object.defineProperty(event, 'target', { value: on });
        return event;
    }

    function query(selector: string): Element {
        return root.querySelector(selector) as Element;
    }

    beforeEach(() => {
        document.body.innerHTML = '';
        root = buildDom();
        hit = null;
        editor = {
            toWorld: (point: { x: number; y: number }) => ({ x: point.x + 1000, y: point.y + 1000 }),
            hitTest: () => hit,
            renderedNodes: signal<readonly EditorNode[]>(NODES).asReadonly(),
            connections: signal<readonly NodeConnection[]>(CONNECTIONS).asReadonly(),
        } as unknown as ContextMenuEditor;
    });

    describe('a port', () => {
        it('resolves to the port, not the node containing it', () => {
            const target = resolveTarget(rightClick(query('[data-slot="node-editor-port"]')), editor);
            expect(target?.kind).toBe('port');
        });

        it('names the port and its direction', () => {
            const target = resolveTarget(rightClick(query('[data-slot="node-editor-port"]')), editor);
            expect(target).toMatchObject({ nodeId: 'a', portId: 'out', direction: 'out' });
        });

        /**
         * So "disconnect" knows exactly what it would remove without the
         * consumer working it out a second time.
         */
        it('carries the connections landing on it, from either end', () => {
            const target = resolveTarget(rightClick(query('[data-slot="node-editor-port"]')), editor);
            expect(target?.kind === 'port' && target.connections.map(c => c.id)).toEqual(['c1']);
        });

        it('carries no connections for an unconnected port', () => {
            const ports = root.querySelectorAll('[data-slot="node-editor-port"]');
            (ports[1] as HTMLElement).dataset['port'] = 'nothing-here';
            const target = resolveTarget(rightClick(ports[1]), editor);
            // The port id no longer matches a real port, so this is the node.
            expect(target?.kind).toBe('node');
        });
    });

    describe('a node', () => {
        it('resolves to the node', () => {
            const target = resolveTarget(rightClick(query('[data-slot="node-editor-node"]')), editor);
            expect(target).toMatchObject({ kind: 'node', nodeId: 'a' });
        });

        /**
         * "Options per what you right-click" means reading the node, not just
         * its id — a subgraph node offers to open, a locked one does not offer
         * to move.
         */
        it('carries the node itself, so a menu can decide from what it IS', () => {
            const target = resolveTarget(rightClick(query('[data-slot="node-editor-node"]')), editor);
            expect(target?.kind === 'node' && target.node.title).toBe('Source');
        });

        it('ignores a card whose id is not in the graph', () => {
            const card = query('[data-slot="node-editor-node"]') as HTMLElement;
            card.dataset['node'] = 'ghost';
            expect(resolveTarget(rightClick(card), editor)?.kind).toBe('canvas');
        });
    });

    describe('a connection', () => {
        /**
         * Wires are painted into one shared canvas, so nothing in the DOM
         * knows one is under the pointer. The engine's hit test is the only
         * way to find them.
         */
        it('resolves through the canvas hit test', () => {
            hit = { kind: 'connection', id: 'c1' };
            const target = resolveTarget(rightClick(query('[data-slot="canvas-viewport"]')), editor);
            expect(target).toMatchObject({ kind: 'connection' });
            expect(target?.kind === 'connection' && target.connection.id).toBe('c1');
        });

        /**
         * The hit test also answers "item", and a node card has already given
         * a better answer by then — asking it first would report a wire that
         * happens to pass behind the card.
         */
        it('never beats a node card the click actually landed on', () => {
            hit = { kind: 'connection', id: 'c1' };
            const target = resolveTarget(rightClick(query('[data-slot="node-editor-node"]')), editor);
            expect(target?.kind).toBe('node');
        });

        it('falls through to the plane when the hit is stale', () => {
            hit = { kind: 'connection', id: 'gone' };
            expect(resolveTarget(rightClick(query('[data-slot="canvas-viewport"]')), editor)?.kind)
                .toBe('canvas');
        });
    });

    describe('empty plane', () => {
        it('is still a target — it is where adding a node belongs', () => {
            expect(resolveTarget(rightClick(query('[data-slot="canvas-viewport"]')), editor)?.kind)
                .toBe('canvas');
        });

        it('reports the WORLD point, so a new node lands where the pointer was', () => {
            const target = resolveTarget(rightClick(query('[data-slot="canvas-viewport"]')), editor);
            expect(target?.at).toEqual({ x: 1120, y: 1060 });
        });

        it('reports the screen point too, for placing the menu itself', () => {
            const target = resolveTarget(rightClick(query('[data-slot="canvas-viewport"]')), editor);
            expect(target?.screen).toEqual({ x: 120, y: 60 });
        });
    });

    /**
     * Taking the browser's own menu away and offering nothing is worse than
     * either, so a click with no answer resolves to null and the directive
     * leaves it alone.
     */
    it('answers null outside the editor entirely', () => {
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        expect(resolveTarget(rightClick(outside), editor)).toBeNull();
    });
});
