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
    /**
     * Positioned to fit the test browser's 414x896 viewport.
     *
     * The editor resolves a drop target with `document.elementFromPoint`, which
     * returns null for anything outside the VIEWPORT — so a node parked beyond
     * the window edge can never be dropped on here, however wide the editor
     * element is. A real pointer is always inside the viewport, so this is a
     * property of the harness, not of the component.
     */
    readonly nodes = signal<readonly EditorNode[]>([
        node('a', START_A.x, START_A.y),
        node('b', START_B.x, START_B.y),
        node('c', 10, 300),
    ]);
    readonly connections = signal<readonly NodeConnection[]>([]);
    readonly selection = signal<EditorSelection>({ nodes: [], connections: [] });
    readonly allowCycles = signal(true);
    readonly gridSnap = signal(0);
    readonly rejections: string[] = [];
}

/** Starting positions, so no assertion hard-codes the fixture's origin. */
const START_A = { x: 10, y: 0 };
const START_B = { x: 215, y: 0 };

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

    /**
     * Where a card is actually drawn, from the engine's own transform.
     *
     * A drag no longer writes the graph on every frame — it moves the cards
     * and commits once on release — so mid-gesture this is the only place the
     * position exists. Reading `nodes()` there would assert the thing the
     * change deliberately stopped doing.
     */
    function cardAt(id: string): { x: number; y: number } {
        const host = nodeEl(id).closest<HTMLElement>('[data-slot="canvas-item"]');
        const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(
            host?.style.transform ?? '',
        );
        return { x: Number(match?.[1] ?? 0), y: Number(match?.[2] ?? 0) };
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
        it('moves the pressed node, and tells the graph on release', async () => {
            const before = host.nodes()[0].x;
            pointer(nodeEl('a'), 'pointerdown', { clientX: 100, clientY: 100 });
            pointer(root, 'pointermove', { clientX: 160, clientY: 140 });
            await settle();

            // The card has moved for the user to see...
            expect(cardAt('a').x).toBeCloseTo(before + 60, 0);
            expect(cardAt('a').y).toBeCloseTo(40, 0);

            // ...while the graph is still where it was. One edit, on release.
            expect(host.nodes().find(n => n.id === 'a')?.x).toBe(before);

            pointer(root, 'pointerup', { clientX: 160, clientY: 140 });
            await settle();

            const after = host.nodes().find(n => n.id === 'a') as EditorNode;
            expect(after.x).toBeCloseTo(before + 60, 0);
            expect(after.y).toBeCloseTo(40, 0);
        });

        it('ignores movement below the drag threshold, so a click is not a move', async () => {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 100, clientY: 100 });
            pointer(root, 'pointermove', { clientX: 101, clientY: 101 });
            await settle();
            expect(host.nodes().find(n => n.id === 'a')?.x).toBe(START_A.x);
        });

        it('applies one move per frame, however many pointer events arrive', async () => {
            /*
             * A node drag replaces the whole node array, and materialising,
             * heights, the id maps, edge descriptors, group membership and
             * the runtime's shape check all hang off that one write. Running
             * it straight off `pointermove` ran the lot two to four times per
             * frame on a high-rate pointer, for frames nobody ever saw.
             *
             * Asserted as: nothing moves until a frame comes round, and the
             * position that lands is the LAST event's, not the first.
             */
            const at = cardAt;

            pointer(nodeEl('a'), 'pointerdown', { clientX: 40, clientY: 40 });
            await settle();
            const before = at('a');

            pointer(root, 'pointermove', { clientX: 90, clientY: 40 });
            pointer(root, 'pointermove', { clientX: 140, clientY: 40 });
            pointer(root, 'pointermove', { clientX: 190, clientY: 40 });
            expect(at('a')).toEqual(before);

            await settle();
            const landed = at('a');
            expect(landed.x).toBe(before.x + 150);

            pointer(root, 'pointerup', { clientX: 190, clientY: 40 });
            await settle();
            expect(at('a')).toEqual(landed);
        });

        it('moves the whole selection when a selected node is dragged', async () => {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 10, clientY: 10 });
            await settle();
            pointer(nodeEl('b'), 'pointerdown', { clientX: 10, clientY: 10, shiftKey: true });
            await settle();

            pointer(nodeEl('b'), 'pointerdown', { clientX: 100, clientY: 100 });
            pointer(root, 'pointermove', { clientX: 150, clientY: 100 });
            await settle();
            pointer(root, 'pointerup', { clientX: 150, clientY: 100 });
            await settle();

            expect(host.nodes().find(n => n.id === 'a')?.x).toBeCloseTo(START_A.x + 50, 0);
            expect(host.nodes().find(n => n.id === 'b')?.x).toBeCloseTo(START_B.x + 50, 0);
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

            // Snapped while it is still being dragged, not only once dropped.
            expect(cardAt('a').x).toBe(50);

            pointer(root, 'pointerup', { clientX: 163, clientY: 100 });
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

        /*
         * Tab must be able to leave.
         *
         * It used to wrap round the node's ports for ever while the handler
         * claimed the key and called `preventDefault`, so once any typed node
         * had focus nothing after the canvas could be reached without a mouse
         * — a keyboard trap, WCAG 2.1.2.
         */
        it('hands Tab back to the browser after the last port', async () => {
            focus('a');
            await settle();

            // a has two ports: in, then out.
            expect(key(nodeEl('a'), { key: 'Tab' }).defaultPrevented).toBe(true);
            await settle();
            expect(key(nodeEl('a'), { key: 'Tab' }).defaultPrevented).toBe(true);
            await settle();

            // Past the last one, the key is not ours.
            const escaping = key(nodeEl('a'), { key: 'Tab' });
            await settle();
            expect(escaping.defaultPrevented).toBe(false);
        });

        it('hands Shift+Tab back before the first port', async () => {
            focus('a');
            await settle();

            const escaping = key(nodeEl('a'), { key: 'Tab', shiftKey: true });
            await settle();
            expect(escaping.defaultPrevented).toBe(false);
        });

        it('still steps through the ports it does own', async () => {
            focus('a');
            await settle();
            expect(key(nodeEl('a'), { key: 'Tab' }).defaultPrevented).toBe(true);
            await settle();

            // Shift+Tab from the second port goes back to the first, not out.
            expect(key(nodeEl('a'), { key: 'Tab' }).defaultPrevented).toBe(true);
            await settle();
            expect(key(nodeEl('a'), { key: 'Tab', shiftKey: true }).defaultPrevented).toBe(true);
        });

        it('starts from the beginning on a different node', async () => {
            focus('a');
            await settle();
            key(nodeEl('a'), { key: 'Tab' });
            key(nodeEl('a'), { key: 'Tab' });
            await settle();

            // Moving to another node must not resume at the previous node's
            // index — the wrap used to hide that by landing somewhere
            // plausible.
            focus('b');
            await settle();
            expect(key(nodeEl('b'), { key: 'Tab' }).defaultPrevented).toBe(true);
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

describe('connecting on a touch device', () => {
    /**
     * Touch pointers have IMPLICIT capture.
     *
     * Once `pointerdown` lands on an element, every subsequent `pointermove`
     * and `pointerup` for that pointer is retargeted to it — `event.target` is
     * the element the finger STARTED on, not the one it is currently over.
     * A mouse does not behave this way, so a drag that works perfectly with a
     * pointing device can be completely impossible with a finger, and the unit
     * tests above would never notice.
     *
     * These dispatch on the SOURCE element with the coordinates of the TARGET,
     * which is exactly what a browser does for touch.
     */
    async function touchDrag(from: [string, string], to: [string, string]): Promise<void> {
        const source = portEl(...from);
        const start = portScreen(...from);
        const end = portScreen(...to);
        const init = { pointerType: 'touch', isPrimary: true };

        pointer(source, 'pointerdown', { clientX: start.x, clientY: start.y, ...init });
        await settle();
        // Retargeted to `source`, per implicit capture.
        pointer(source, 'pointermove', { clientX: end.x, clientY: end.y, ...init });
        await settle();
        pointer(source, 'pointerup', { clientX: end.x, clientY: end.y, ...init });
        await settle();
    }

    it('connects two ports with a finger', async () => {
        await touchDrag(['a', 'out'], ['b', 'in']);

        expect(host.connections()).toHaveLength(1);
        expect(host.connections()[0]).toMatchObject({ source: 'a', target: 'b' });
    });

    it('marks the port under the finger, not the one it started on', async () => {
        const start = portScreen('a', 'out');
        const end = portScreen('b', 'in');
        const init = { pointerType: 'touch', isPrimary: true };

        pointer(portEl('a', 'out'), 'pointerdown', { clientX: start.x, clientY: start.y, ...init });
        await settle();
        pointer(portEl('a', 'out'), 'pointermove', { clientX: end.x, clientY: end.y, ...init });
        await settle();

        expect(portEl('b', 'in').dataset['drop']).toBe('valid');
        expect(portEl('a', 'out').dataset['drop']).toBeUndefined();
    });

    it('still refuses an invalid target, with the same reason as a mouse would give', async () => {
        await touchDrag(['a', 'out'], ['a', 'in']);
        expect(host.rejections).toEqual(['same-node']);
        expect(host.connections()).toEqual([]);
    });

    it('moves a node with a finger', async () => {
        const card = nodeEl('a');
        const init = { pointerType: 'touch', isPrimary: true };

        pointer(card, 'pointerdown', { clientX: 100, clientY: 100, ...init });
        pointer(card, 'pointermove', { clientX: 190, clientY: 100, ...init });
        await settle();
        pointer(card, 'pointerup', { clientX: 190, clientY: 100, ...init });
        await settle();

        expect(host.nodes().find(n => n.id === 'a')?.x).toBeCloseTo(START_A.x + 90, 0);
    });

    it('abandons a pending connection when the gesture is cancelled', async () => {
        const start = portScreen('a', 'out');
        const init = { pointerType: 'touch', isPrimary: true };

        pointer(portEl('a', 'out'), 'pointerdown', { clientX: start.x, clientY: start.y, ...init });
        await settle();
        pointer(portEl('a', 'out'), 'pointercancel', { ...init });
        await settle();

        expect(host.connections()).toEqual([]);
        expect(root.querySelector('[data-slot="node-editor-pending"]')).toBeNull();
    });
});

    /*
     * A drag and a nudge are undoable moves.
     *
     * `GraphHistory.push`'s own documentation says a drag arrives as one
     * `move-nodes` on pointer-up "and the editor does it". It did not: only
     * the public `moveNodes`/`placeNodes` recorded anything, so a hand-drag
     * left no entry at all and Ctrl+Z reached PAST it to whatever came before
     * — undoing an edit nobody asked to undo, and, after an auto-layout,
     * applying that command's negated deltas to positions they were never
     * computed against.
     */
    describe('a move reaches the undo stack however it was made', () => {
        function positionOf(id: string): { x: number; y: number } {
            const node = host.nodes().find(candidate => candidate.id === id);
            return { x: node?.x ?? 0, y: node?.y ?? 0 };
        }

        async function dragA(): Promise<void> {
            pointer(nodeEl('a'), 'pointerdown', { clientX: 40, clientY: 40 });
            await settle();
            pointer(root, 'pointermove', { clientX: 110, clientY: 90 });
            await settle();
            pointer(root, 'pointerup', { clientX: 110, clientY: 90 });
            await settle();
        }

        it('undoes a pointer drag, putting the node back where it started', async () => {
            const before = positionOf('a');
            await dragA();
            expect(positionOf('a')).not.toEqual(before);

            key(root, { key: 'z', ctrlKey: true });
            await settle();

            expect(positionOf('a')).toEqual(before);
        });

        it('redoes the drag it just undid', async () => {
            const before = positionOf('a');
            await dragA();
            const after = positionOf('a');

            key(root, { key: 'z', ctrlKey: true });
            await settle();
            expect(positionOf('a')).toEqual(before);

            key(root, { key: 'y', ctrlKey: true });
            await settle();
            expect(positionOf('a')).toEqual(after);
        });

        it('does not reach past the drag to an earlier edit', async () => {
            // Move once through the public API, then drag by hand. One undo
            // must take back the DRAG, not the earlier move.
            const start = positionOf('a');
            pointer(nodeEl('a'), 'pointerdown', { clientX: 40, clientY: 40 });
            await settle();
            pointer(root, 'pointermove', { clientX: 70, clientY: 60 });
            await settle();
            pointer(root, 'pointerup', { clientX: 70, clientY: 60 });
            await settle();
            const afterFirst = positionOf('a');
            expect(afterFirst).not.toEqual(start);

            await dragA();
            key(root, { key: 'z', ctrlKey: true });
            await settle();

            expect(positionOf('a')).toEqual(afterFirst);
        });

        it('undoes a keyboard nudge', async () => {
            // Focus is `focusin`, and it is SHIFT+arrow that moves the node —
            // a bare arrow moves focus between nodes instead. Aiming at the
            // wrong one made this test assert that nothing had happened.
            nodeEl('a').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            await settle();

            const before = positionOf('a');
            key(nodeEl('a'), { key: 'ArrowRight', shiftKey: true });
            await settle();
            expect(positionOf('a').x).toBeGreaterThan(before.x);

            key(root, { key: 'z', ctrlKey: true });
            await settle();

            expect(positionOf('a')).toEqual(before);
        });
    });

    /*
     * Wiring and deleting are undoable too, and a restored node is not empty.
     *
     * `connect` recorded nothing at all, so connecting a freshly added node
     * and undoing destroyed the wire outright: `add-nodes`' inverse removes
     * every edge touching the node, including the one it was never told about,
     * and the redo put the node back with no connections. And `remove-nodes`
     * carried nodes and edges but not STATE — which for a subgraph node is its
     * entire inner graph.
     */
    describe('connecting and deleting survive a round trip', () => {
        /** The editor instance the host renders. */
        function editorOf(): NodeEditorComponent {
            return fixture.debugElement.children[0].componentInstance as NodeEditorComponent;
        }

        it('undoes and redoes a connection made with the pointer', async () => {
            await connectByDrag(['a', 'out'], ['b', 'in']);
            expect(host.connections()).toHaveLength(1);
            const made = host.connections()[0].id;

            key(root, { key: 'z', ctrlKey: true });
            await settle();
            expect(host.connections()).toEqual([]);

            key(root, { key: 'y', ctrlKey: true });
            await settle();
            expect(host.connections()).toHaveLength(1);
            expect(host.connections()[0].id).toBe(made);
        });

        it('undoes a reconnection, putting the displaced wire back', async () => {
            /*
             * The gesture the `rewire` kind exists for, and the one nothing
             * covered: grabbing an occupied input unplugs its wire, and
             * dropping it elsewhere is ONE edit. A test that connects into an
             * EMPTY input never fills `removed`, so it stays green with the
             * detached half thrown away — and Ctrl+Z then removes the new wire
             * without restoring the old one.
             */
            await connectByDrag(['a', 'out'], ['b', 'in']);
            expect(host.connections()).toHaveLength(1);

            await connectByDrag(['b', 'in'], ['c', 'in']);
            expect(host.connections()).toHaveLength(1);
            expect(host.connections()[0]).toMatchObject({ source: 'a', target: 'c' });

            key(root, { key: 'z', ctrlKey: true });
            await settle();

            expect(host.connections()).toHaveLength(1);
            expect(host.connections()[0]).toMatchObject({ source: 'a', target: 'b' });
        });

        it('undoes unplugging a wire into empty space', async () => {
            await connectByDrag(['a', 'out'], ['b', 'in']);

            const source = portEl('b', 'in');
            const rect = root.getBoundingClientRect();
            pointer(source, 'pointerdown', { clientX: 0, clientY: 0 });
            await settle();
            pointer(root, 'pointermove', { clientX: rect.left + 600, clientY: rect.top + 500 });
            await settle();
            pointer(root, 'pointerup', { clientX: rect.left + 600, clientY: rect.top + 500 });
            await settle();
            expect(host.connections()).toEqual([]);

            key(root, { key: 'z', ctrlKey: true });
            await settle();

            expect(host.connections()).toHaveLength(1);
            expect(host.connections()[0]).toMatchObject({ source: 'a', target: 'b' });
        });

        it('undoes a connection made with the keyboard', async () => {
            // Pointer and keyboard must not disagree about history either.
            //
            // Named `focusNode`, not `focus`: a bare `focus(id)` here resolves
            // to `window.focus` and silently does nothing, which is how this
            // test first passed while exercising no gesture at all.
            const focusNode = (id: string): void => {
                nodeEl(id).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            };

            focusNode('a');
            await settle();
            key(nodeEl('a'), { key: 'Tab' });
            key(nodeEl('a'), { key: 'Tab' });
            await settle();
            key(nodeEl('a'), { key: 'Enter' });
            await settle();
            focusNode('b');
            key(nodeEl('b'), { key: 'Tab' });
            await settle();
            key(nodeEl('b'), { key: 'Enter' });
            await settle();
            expect(host.connections()).toHaveLength(1);

            key(root, { key: 'z', ctrlKey: true });
            await settle();

            expect(host.connections()).toEqual([]);
        });

        it('keeps the wire when the drop is refused', async () => {
            /*
             * A refused drop is a failed gesture, not an edit. Dropping an
             * unplugged wire on a port that cannot take it announced "cannot
             * connect" and kept the deletion — so the wire the user was
             * MOVING was gone, while the screen reader said nothing happened.
             */
            await connectByDrag(['a', 'out'], ['b', 'in']);

            await connectByDrag(['b', 'in'], ['c', 'out']);

            expect(host.rejections).toContain('same-direction');
            expect(host.connections()).toHaveLength(1);
            expect(host.connections()[0]).toMatchObject({ source: 'a', target: 'b' });
        });

        it('undoes the wire it just made, not another one', async () => {
            /*
             * `connect` records the edge it added. It used to FIND that edge
             * by scanning for the one not already present; `at(-1)` is the
             * same answer because `addConnection` appends. Either way, no
             * test could tell them apart while every undo test had a single
             * wire on the board — and `next[0]` is green with one wire and
             * catastrophic with two: Ctrl+Z deletes an unrelated connection
             * and leaves the new one.
             */
            await connectByDrag(['a', 'out'], ['b', 'in']);
            await connectByDrag(['a', 'out'], ['c', 'in']);
            expect(host.connections()).toHaveLength(2);

            key(root, { key: 'z', ctrlKey: true });
            await settle();

            expect(host.connections()).toHaveLength(1);
            expect(host.connections()[0]).toMatchObject({ source: 'a', target: 'b' });
        });

        it('redoes an unplug, taking the wire away again', async () => {
            await connectByDrag(['a', 'out'], ['b', 'in']);

            const rect = root.getBoundingClientRect();
            pointer(portEl('b', 'in'), 'pointerdown', { clientX: 0, clientY: 0 });
            await settle();
            pointer(root, 'pointerup', { clientX: rect.left + 600, clientY: rect.top + 500 });
            await settle();
            expect(host.connections()).toEqual([]);

            key(root, { key: 'z', ctrlKey: true });
            await settle();
            expect(host.connections()).toHaveLength(1);

            // `added: removed` would leave undo looking right and make redo a
            // no-op, so an unplug could never be redone.
            key(root, { key: 'y', ctrlKey: true });
            await settle();
            expect(host.connections()).toEqual([]);
        });

        it('has nothing to undo after a refused drop', async () => {
            await connectByDrag(['a', 'out'], ['b', 'in']);
            await connectByDrag(['b', 'in'], ['c', 'out']);
            expect(host.connections()).toHaveLength(1);

            /*
             * A refused drop is a failed gesture, not an edit, so it adds no
             * step: the one Ctrl+Z on the stack undoes the CONNECTION and
             * leaves nothing. Recording the refusal instead would make the
             * first Ctrl+Z put back the wire the refusal had deleted — the
             * user pressing undo once and seeing the board unchanged.
             */
            key(root, { key: 'z', ctrlKey: true });
            await settle();

            expect(host.connections()).toEqual([]);
        });

        it('gives a restored node back the state it held', async () => {
            const editor = editorOf();
            editor.runtime.setState('a', { remembered: 'inside' });
            await settle();

            host.selection.set({ nodes: ['a'], connections: [] });
            await settle();
            editor.deleteSelection();
            await settle();
            expect(host.nodes().some(node => node.id === 'a')).toBe(false);

            key(root, { key: 'z', ctrlKey: true });
            await settle();

            expect(host.nodes().some(node => node.id === 'a')).toBe(true);
            expect(editor.runtime.state('a')()).toEqual({ remembered: 'inside' });
        });
    });
});
