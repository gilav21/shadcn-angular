// T-7, T-8, T-9 from `specs/node-editor-spec.md`.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NodeEditorComponent } from './node-editor.component';
import { POINTER_METRICS, portAnchor } from './node-editor.layout';
import type { EditorNode, EditorSelection, NodeConnection } from './node-editor.types';

function node(id: string, x: number, y: number, extra: Partial<EditorNode> = {}): EditorNode {
    return {
        id,
        x,
        y,
        width: 180,
        height: 0,
        title: `Node ${id}`,
        ports: [
            { id: 'in', direction: 'in', label: 'Input' },
            { id: 'out', direction: 'out', label: 'Output' },
        ],
        ...extra,
    };
}

@Component({
    standalone: true,
    imports: [NodeEditorComponent],
    template: `
    <ui-node-editor
      class="h-[600px] w-[900px]"
      [(nodes)]="nodes"
      [(connections)]="connections"
      [(selection)]="selection"
      [allowCycles]="allowCycles()"
      [gridSnap]="gridSnap()"
      (connectionRejected)="rejections.push($event.reason)"
    />
  `,
})
class HostComponent {
    readonly nodes = signal<readonly EditorNode[]>([
        node('a', 0, 0),
        node('b', 400, 0),
        node('c', 0, 300),
    ]);
    readonly connections = signal<readonly NodeConnection[]>([]);
    readonly selection = signal<EditorSelection>({ nodes: [], connections: [] });
    readonly allowCycles = signal(true);
    readonly gridSnap = signal(0);
    readonly rejections: string[] = [];
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

describe('NodeEditorComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;
    let root: HTMLElement;

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await nextFrame();
        fixture.detectChanges();
    }

    function nodeEl(id: string): HTMLElement {
        const el = root.querySelector<HTMLElement>(
            `[data-slot="node-editor-node"][data-node="${id}"]`,
        );
        if (!el) throw new Error(`node ${id} is not mounted`);
        return el;
    }

    function portEl(nodeId: string, portId: string): HTMLElement {
        const el = root.querySelector<HTMLElement>(
            `[data-slot="node-editor-port"][data-node="${nodeId}"][data-port="${portId}"]`,
        );
        if (!el) throw new Error(`port ${nodeId}.${portId} is not mounted`);
        return el;
    }

    /** Screen position of a port, derived the way the editor derives it. */
    function portScreen(nodeId: string, portId: string): { x: number; y: number } {
        const target = host.nodes().find(n => n.id === nodeId) as EditorNode;
        const offset = portAnchor(target, portId, POINTER_METRICS) ?? { x: 0, y: 0 };
        const rect = root.getBoundingClientRect();
        return { x: rect.left + target.x + offset.x, y: rect.top + target.y + offset.y };
    }

    function pointer(
        target: EventTarget,
        type: string,
        init: PointerEventInit = {},
    ): void {
        target.dispatchEvent(
            new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                button: 0,
                ...init,
            }),
        );
    }

    function key(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
        target.dispatchEvent(event);
        return event;
    }

    /** Drag from one port to another, as a pointer user would. */
    async function connectByDrag(from: [string, string], to: [string, string]): Promise<void> {
        const source = portEl(...from);
        const targetEl = portEl(...to);
        const end = portScreen(...to);

        pointer(source, 'pointerdown', { clientX: 0, clientY: 0 });
        await settle();
        pointer(targetEl, 'pointermove', { clientX: end.x, clientY: end.y });
        await settle();
        pointer(targetEl, 'pointerup', { clientX: end.x, clientY: end.y });
        await settle();
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
        root = fixture.nativeElement.querySelector('[data-slot="node-editor"]') as HTMLElement;
        await settle();
    });

    afterEach(() => fixture.destroy());

    describe('T-7 rendering', () => {
        it('mounts a card for each node', () => {
            expect(root.querySelectorAll('[data-slot="node-editor-node"]')).toHaveLength(3);
        });

        it('renders the node title', () => {
            expect(nodeEl('a').textContent).toContain('Node a');
        });

        it('renders a dot for every port', () => {
            // Ports are SIBLINGS of the card, not children — nesting a button
            // inside a button is an axe `nested-interactive` violation. So this
            // queries the canvas item wrapper, which holds both.
            const wrapper = nodeEl('a').closest('[data-slot="canvas-item"]') as HTMLElement;
            expect(wrapper.querySelectorAll('[data-slot="node-editor-port"]')).toHaveLength(2);
        });

        it('derives each node height from its ports rather than trusting the input', () => {
            // Every node was authored with height 0.
            expect(host.nodes().every(n => n.height === 0)).toBe(true);
            const rendered = nodeEl('a').closest<HTMLElement>('[data-slot="canvas-item"]');
            expect(Number.parseFloat(rendered?.style.height ?? '0')).toBeGreaterThan(0);
        });
    });

    describe('T-7 selection', () => {
        it('selects the node that was pressed', async () => {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 10, clientY: 10 });
            await settle();
            expect(host.selection().nodes).toEqual(['a']);
        });

        it('replaces the selection on a plain press', async () => {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 10, clientY: 10 });
            await settle();
            pointer(nodeEl('b'), 'pointerdown', { clientX: 10, clientY: 10 });
            await settle();
            expect(host.selection().nodes).toEqual(['b']);
        });

        it('adds to the selection on shift-press', async () => {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 10, clientY: 10 });
            await settle();
            pointer(nodeEl('b'), 'pointerdown', { clientX: 10, clientY: 10, shiftKey: true });
            await settle();
            expect([...host.selection().nodes].sort((x, y) => String(x).localeCompare(String(y))))
                .toEqual(['a', 'b']);
        });

        it('clears the selection when the plane is pressed', async () => {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 10, clientY: 10 });
            await settle();
            pointer(root, 'pointerdown', { clientX: 800, clientY: 500 });
            await settle();
            expect(host.selection().nodes).toEqual([]);
        });

        it('marks the selected card, so selection is visible and not just modelled', async () => {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 10, clientY: 10 });
            await settle();
            expect(nodeEl('a').dataset['selected']).toBe('true');
        });
    });

    describe('T-7 dragging', () => {
        it('moves the pressed node', async () => {
            const before = host.nodes()[0].x;
            pointer(nodeEl('a'), 'pointerdown', { clientX: 100, clientY: 100 });
            pointer(root, 'pointermove', { clientX: 160, clientY: 140 });
            await settle();

            const after = host.nodes().find(n => n.id === 'a') as EditorNode;
            expect(after.x).toBeCloseTo(before + 60, 0);
            expect(after.y).toBeCloseTo(40, 0);
        });

        it('ignores movement below the drag threshold, so a click is not a move', async () => {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 100, clientY: 100 });
            pointer(root, 'pointermove', { clientX: 101, clientY: 101 });
            await settle();
            expect(host.nodes().find(n => n.id === 'a')?.x).toBe(0);
        });

        it('moves the whole selection when a selected node is dragged', async () => {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 10, clientY: 10 });
            await settle();
            pointer(nodeEl('b'), 'pointerdown', { clientX: 10, clientY: 10, shiftKey: true });
            await settle();

            pointer(nodeEl('b'), 'pointerdown', { clientX: 100, clientY: 100 });
            pointer(root, 'pointermove', { clientX: 150, clientY: 100 });
            await settle();

            expect(host.nodes().find(n => n.id === 'a')?.x).toBeCloseTo(50, 0);
            expect(host.nodes().find(n => n.id === 'b')?.x).toBeCloseTo(450, 0);
        });

        it('does not move a locked node', async () => {
            host.nodes.set([node('a', 0, 0, { locked: true })]);
            await settle();

            pointer(nodeEl('a'), 'pointerdown', { clientX: 100, clientY: 100 });
            pointer(root, 'pointermove', { clientX: 200, clientY: 200 });
            await settle();
            expect(host.nodes()[0].x).toBe(0);
        });

        it('snaps to the grid when one is set', async () => {
            host.gridSnap.set(50);
            await settle();

            pointer(nodeEl('a'), 'pointerdown', { clientX: 100, clientY: 100 });
            pointer(root, 'pointermove', { clientX: 163, clientY: 100 });
            await settle();
            expect(host.nodes().find(n => n.id === 'a')?.x).toBe(50);
        });

        it('stops moving after the pointer is released', async () => {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 100, clientY: 100 });
            pointer(root, 'pointermove', { clientX: 150, clientY: 100 });
            await settle();
            pointer(root, 'pointerup', { clientX: 150, clientY: 100 });
            await settle();

            const parked = host.nodes().find(n => n.id === 'a')?.x;
            pointer(root, 'pointermove', { clientX: 400, clientY: 100 });
            await settle();
            expect(host.nodes().find(n => n.id === 'a')?.x).toBe(parked);
        });
    });

    describe('T-8 connecting with a pointer', () => {
        it('creates a connection between the two ports', async () => {
            await connectByDrag(['a', 'out'], ['b', 'in']);
            expect(host.connections()).toHaveLength(1);
            expect(host.connections()[0]).toMatchObject({
                source: 'a',
                sourcePort: 'out',
                target: 'b',
                targetPort: 'in',
            });
        });

        it('draws a pending edge while the drag is in flight', async () => {
            pointer(portEl('a', 'out'), 'pointerdown', { clientX: 0, clientY: 0 });
            await settle();
            expect(root.querySelector('[data-slot="node-editor-pending"]')).not.toBeNull();

            pointer(root, 'pointerup', { clientX: 0, clientY: 0 });
            await settle();
            expect(root.querySelector('[data-slot="node-editor-pending"]')).toBeNull();
        });

        it('drops the connection when released over empty space', async () => {
            pointer(portEl('a', 'out'), 'pointerdown', { clientX: 0, clientY: 0 });
            await settle();
            pointer(root, 'pointerup', { clientX: 700, clientY: 500 });
            await settle();
            expect(host.connections()).toEqual([]);
        });

        it('reports the reason when the drop is invalid', async () => {
            await connectByDrag(['a', 'out'], ['a', 'in']);
            expect(host.rejections).toEqual(['same-node']);
            expect(host.connections()).toEqual([]);
        });

        it('marks the hovered port valid or invalid BEFORE release', async () => {
            pointer(portEl('a', 'out'), 'pointerdown', { clientX: 0, clientY: 0 });
            await settle();

            const good = portScreen('b', 'in');
            pointer(portEl('b', 'in'), 'pointermove', { clientX: good.x, clientY: good.y });
            await settle();
            expect(portEl('b', 'in').dataset['drop']).toBe('valid');

            const bad = portScreen('b', 'out');
            pointer(portEl('b', 'out'), 'pointermove', { clientX: bad.x, clientY: bad.y });
            await settle();
            expect(portEl('b', 'out').dataset['drop']).toBe('invalid');
        });

        it('marks a connected port so the dot reads as occupied', async () => {
            await connectByDrag(['a', 'out'], ['b', 'in']);
            expect(portEl('b', 'in').dataset['connected']).toBe('true');
        });
    });

    describe('T-8 disconnecting', () => {
        it('detaches the existing edge when its input end is grabbed', async () => {
            await connectByDrag(['a', 'out'], ['b', 'in']);
            expect(host.connections()).toHaveLength(1);

            pointer(portEl('b', 'in'), 'pointerdown', { clientX: 0, clientY: 0 });
            await settle();
            // Detached immediately, so the wire follows the pointer rather than
            // leaving a duplicate behind.
            expect(host.connections()).toEqual([]);
        });

        it('deletes it for good when dropped in empty space', async () => {
            await connectByDrag(['a', 'out'], ['b', 'in']);
            pointer(portEl('b', 'in'), 'pointerdown', { clientX: 0, clientY: 0 });
            await settle();
            pointer(root, 'pointerup', { clientX: 750, clientY: 520 });
            await settle();
            expect(host.connections()).toEqual([]);
        });

        it('re-homes it when dropped on another input', async () => {
            await connectByDrag(['a', 'out'], ['b', 'in']);
            pointer(portEl('b', 'in'), 'pointerdown', { clientX: 0, clientY: 0 });
            await settle();

            const end = portScreen('c', 'in');
            pointer(portEl('c', 'in'), 'pointermove', { clientX: end.x, clientY: end.y });
            await settle();
            pointer(portEl('c', 'in'), 'pointerup', { clientX: end.x, clientY: end.y });
            await settle();

            expect(host.connections()).toHaveLength(1);
            expect(host.connections()[0].target).toBe('c');
        });
    });

    describe('T-9 keyboard', () => {
        function focus(id: string): void {
            nodeEl(id).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        }

        it('moves focus to the nearest node in the arrow direction', async () => {
            focus('a');
            await settle();
            key(nodeEl('a'), { key: 'ArrowRight' });
            await settle();
            // b is directly right; c is directly below and must not win.
            expect(nodeEl('b').getAttribute('tabindex')).toBe('0');
        });

        it('ignores a direction with nothing in it', async () => {
            focus('a');
            await settle();
            key(nodeEl('a'), { key: 'ArrowLeft' });
            await settle();
            expect(nodeEl('a').getAttribute('tabindex')).toBe('0');
        });

        it('nudges the node with shift+arrow', async () => {
            focus('a');
            await settle();
            key(nodeEl('a'), { key: 'ArrowRight', shiftKey: true });
            await settle();
            expect(host.nodes().find(n => n.id === 'a')?.x).toBeGreaterThan(0);
        });

        it('nudges by one grid cell when snapping is on', async () => {
            host.gridSnap.set(25);
            await settle();
            focus('a');
            key(nodeEl('a'), { key: 'ArrowRight', shiftKey: true });
            await settle();
            expect(host.nodes().find(n => n.id === 'a')?.x).toBe(25);
        });

        it('stops arrows reaching the canvas, which would pan instead', async () => {
            focus('a');
            await settle();
            const event = key(nodeEl('a'), { key: 'ArrowRight' });
            expect(event.defaultPrevented).toBe(true);
        });

        it('cycles ports with Tab', async () => {
            focus('a');
            await settle();
            key(nodeEl('a'), { key: 'Tab' });
            await settle();
            expect(root.querySelector('[data-slot="node-editor-port"][data-node="a"]'))
                .not.toBeNull();
        });

        it('connects two ports with Enter, Tab, Enter', async () => {
            focus('a');
            await settle();
            key(nodeEl('a'), { key: 'Tab' });          // -> a.in
            key(nodeEl('a'), { key: 'Tab' });          // -> a.out
            await settle();
            key(nodeEl('a'), { key: 'Enter' });        // start
            await settle();

            focus('b');
            key(nodeEl('b'), { key: 'Tab' });          // -> b.in
            await settle();
            key(nodeEl('b'), { key: 'Enter' });        // commit
            await settle();

            expect(host.connections()).toHaveLength(1);
            expect(host.connections()[0]).toMatchObject({ source: 'a', target: 'b' });
        });

        it('cancels a keyboard connection with Escape', async () => {
            focus('a');
            key(nodeEl('a'), { key: 'Tab' });
            key(nodeEl('a'), { key: 'Tab' });
            await settle();
            key(nodeEl('a'), { key: 'Enter' });
            await settle();
            key(nodeEl('a'), { key: 'Escape' });
            await settle();

            expect(root.querySelector('[data-slot="node-editor-pending"]')).toBeNull();
            expect(host.connections()).toEqual([]);
        });

        it('deletes the selection with Delete', async () => {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 10, clientY: 10 });
            await settle();
            key(nodeEl('a'), { key: 'Delete' });
            await settle();
            expect(host.nodes().map(n => n.id)).toEqual(['b', 'c']);
        });

        it('removes a deleted node’s connections with it', async () => {
            await connectByDrag(['a', 'out'], ['b', 'in']);
            pointer(nodeEl('a'), 'pointerdown', { clientX: 10, clientY: 10 });
            await settle();
            key(nodeEl('a'), { key: 'Delete' });
            await settle();
            expect(host.connections()).toEqual([]);
        });

        it('selects everything with Ctrl+A', async () => {
            key(root, { key: 'a', ctrlKey: true });
            await settle();
            expect(host.selection().nodes).toHaveLength(3);
        });

        it('clears the selection with Escape', async () => {
            key(root, { key: 'a', ctrlKey: true });
            await settle();
            key(root, { key: 'Escape' });
            await settle();
            expect(host.selection().nodes).toEqual([]);
        });
    });

    describe('the keyboard and the pointer agree about what is allowed', () => {
        /**
         * The reason `canConnect` is one shared function. A keyboard user who
         * could complete a connection the pointer refuses would be a bug that
         * only ever showed up for keyboard users.
         */
        it('refuses the same pair either way, for the same reason', async () => {
            host.allowCycles.set(false);
            await connectByDrag(['a', 'out'], ['b', 'in']);
            host.rejections.length = 0;

            // Pointer: b.out -> a.in would close a cycle.
            await connectByDrag(['b', 'out'], ['a', 'in']);
            const viaPointer = [...host.rejections];
            host.rejections.length = 0;

            // Keyboard: the same pair.
            nodeEl('b').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            key(nodeEl('b'), { key: 'Tab' });
            key(nodeEl('b'), { key: 'Tab' });
            await settle();
            key(nodeEl('b'), { key: 'Enter' });
            await settle();
            nodeEl('a').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            key(nodeEl('a'), { key: 'Tab' });
            await settle();
            key(nodeEl('a'), { key: 'Enter' });
            await settle();

            expect(viaPointer).toEqual(['cycle']);
            expect(host.rejections).toEqual(['cycle']);
        });
    });

    describe('readonly graphs', () => {
        it('refuses every mutation', async () => {
            const readonlyFixture = TestBed.createComponent(NodeEditorComponent);
            readonlyFixture.componentRef.setInput('nodes', [node('a', 0, 0), node('b', 400, 0)]);
            readonlyFixture.componentRef.setInput('readonlyGraph', true);
            readonlyFixture.detectChanges();
            await readonlyFixture.whenStable();
            await nextFrame();

            const el = readonlyFixture.nativeElement as HTMLElement;
            const card = el.querySelector<HTMLElement>('[data-slot="node-editor-node"]');
            card?.dispatchEvent(
                new PointerEvent('pointerdown', {
                    bubbles: true, cancelable: true, pointerId: 1, clientX: 100, clientY: 100,
                }),
            );
            el.dispatchEvent(
                new PointerEvent('pointermove', {
                    bubbles: true, cancelable: true, pointerId: 1, clientX: 300, clientY: 300,
                }),
            );
            readonlyFixture.detectChanges();

            expect(readonlyFixture.componentInstance.nodes()[0].x).toBe(0);
            readonlyFixture.destroy();
        });
    });
});
