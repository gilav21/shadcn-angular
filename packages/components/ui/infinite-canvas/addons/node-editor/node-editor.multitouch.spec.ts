// Two fingers mean pan and zoom, never editing.
//
// Reported from a phone: pinching to zoom while one finger happened to rest on
// a node dragged the node instead. Two fingers are a viewport gesture in every
// canvas application, and anything the first finger started has to be given up
// — including putting back what it had already moved.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NodeEditorComponent } from './node-editor.component';
import type { EditorNode, NodeConnection } from './node-editor.types';

@Component({
    standalone: true,
    imports: [NodeEditorComponent],
    template: `
    <ui-node-editor
      class="h-[400px] w-[400px]"
      [(nodes)]="nodes"
      [(connections)]="connections"
    />
  `,
})
class HostComponent {
    readonly nodes = signal<readonly EditorNode[]>([
        {
            id: 'a',
            x: 40,
            y: 40,
            width: 170,
            height: 0,
            title: 'A',
            ports: [{ id: 'out', direction: 'out', label: 'Out' }],
        },
        {
            id: 'b',
            x: 40,
            y: 240,
            width: 170,
            height: 0,
            title: 'B',
            ports: [{ id: 'in', direction: 'in', label: 'In' }],
        },
    ]);
    readonly connections = signal<readonly NodeConnection[]>([]);
}

/** Shared by both suites below, so neither duplicates the other. */
async function settleFixture(fixture: ComponentFixture<HostComponent>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await nextFrame();
    fixture.detectChanges();
}

function findPort(
    fixture: ComponentFixture<HostComponent>,
    node: string,
    port: string,
): HTMLElement {
    return fixture.nativeElement.querySelector(
        `[data-slot="node-editor-port"][data-node="${node}"][data-port="${port}"]`,
    );
}

/** A touch. `isPrimary` is what distinguishes the first finger. */
function dispatchTouch(target: EventTarget, type: string, init: PointerEventInit): void {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            button: 0,
            pointerType: 'touch',
            ...init,
        }),
    );
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

describe('a second finger takes over from an edit', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    const settle = (): Promise<void> => settleFixture(fixture);
    const portEl = (node: string, port: string): HTMLElement => findPort(fixture, node, port);
    const touch = dispatchTouch;

    function nodeEl(id: string): HTMLElement {
        return fixture.nativeElement.querySelector(
            `[data-slot="node-editor-node"][data-node="${id}"]`,
        );
    }

    function positionOf(id: string): { x: number; y: number } {
        const node = host.nodes().find(candidate => candidate.id === id);
        return { x: node?.x ?? 0, y: node?.y ?? 0 };
    }

    /**
     * Where the card is DRAWN.
     *
     * A drag moves the cards and writes the graph once, on release, so
     * mid-gesture the graph still holds where the node started — `positionOf`
     * would report "has not moved" for a node visibly under the finger.
     */
    function cardAt(id: string): { x: number; y: number } {
        const host = nodeEl(id).closest<HTMLElement>('[data-slot="canvas-item"]');
        const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(
            host?.style.transform ?? '',
        );
        return { x: Number(match?.[1] ?? 0), y: Number(match?.[2] ?? 0) };
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
    });

    afterEach(() => fixture.destroy());

    /**
     * The reported bug: one finger on a node, the other pinching, and the node
     * travels across the canvas while you are only trying to zoom.
     */
    it('puts a half-dragged node back when a second finger lands', async () => {
        const before = cardAt('a');

        touch(nodeEl('a'), 'pointerdown', { pointerId: 1, isPrimary: true, clientX: 50, clientY: 50 });
        touch(nodeEl('a'), 'pointermove', { pointerId: 1, isPrimary: true, clientX: 220, clientY: 180 });
        await settle();
        expect(cardAt('a')).not.toEqual(before);

        // The pinch begins.
        touch(nodeEl('b'), 'pointerdown', { pointerId: 2, isPrimary: false, clientX: 300, clientY: 300 });
        await settle();

        expect(cardAt('a')).toEqual(before);

        // And the graph was never told about a gesture that was abandoned.
        expect(positionOf('a')).toEqual(before);
    });

    it('stops the node following the first finger after that', async () => {
        const before = positionOf('a');

        touch(nodeEl('a'), 'pointerdown', { pointerId: 1, isPrimary: true, clientX: 50, clientY: 50 });
        touch(nodeEl('a'), 'pointermove', { pointerId: 1, isPrimary: true, clientX: 120, clientY: 120 });
        touch(nodeEl('b'), 'pointerdown', { pointerId: 2, isPrimary: false, clientX: 300, clientY: 300 });
        await settle();

        // Whatever the fingers do now belongs to the viewport.
        touch(nodeEl('a'), 'pointermove', { pointerId: 1, isPrimary: true, clientX: 380, clientY: 360 });
        await settle();

        expect(positionOf('a')).toEqual(before);
    });

    it('abandons a half-drawn connection too', async () => {
        touch(portEl('a', 'out'), 'pointerdown', { pointerId: 1, isPrimary: true, clientX: 60, clientY: 60 });
        await settle();

        touch(nodeEl('b'), 'pointerdown', { pointerId: 2, isPrimary: false, clientX: 300, clientY: 300 });
        await settle();

        // No wire left hanging off the pointer, and nothing connected.
        expect(fixture.nativeElement.querySelector('[data-slot="node-editor-pending"]')).toBeNull();
        expect(host.connections()).toHaveLength(0);
    });

    /**
     * A press that never moved has nothing to put back, and the node must not
     * jump anywhere when the second finger arrives.
     */
    it('leaves a node alone when the first finger never moved it', async () => {
        const before = positionOf('a');

        touch(nodeEl('a'), 'pointerdown', { pointerId: 1, isPrimary: true, clientX: 50, clientY: 50 });
        touch(nodeEl('b'), 'pointerdown', { pointerId: 2, isPrimary: false, clientX: 300, clientY: 300 });
        await settle();

        expect(positionOf('a')).toEqual(before);
    });

    /**
     * A mouse has one pointer and reports every press as primary. Narrowing
     * the rule to touch keeps the desktop drag exactly as it was.
     */
    it('does not disturb a mouse drag', async () => {
        const before = cardAt('a');

        nodeEl('a').dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, cancelable: true, button: 0, pointerId: 1,
            pointerType: 'mouse', clientX: 50, clientY: 50,
        }));
        nodeEl('a').dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true, cancelable: true, pointerId: 1,
            pointerType: 'mouse', clientX: 200, clientY: 170,
        }));
        await settle();

        expect(cardAt('a')).not.toEqual(before);
    });
});

/*
 * Unplugging a wire and then NOT completing the gesture.
 *
 * Grabbing an occupied input detaches its connection immediately, before any
 * movement, because that is what "unplug this" has to feel like. The wire is
 * kept on the pending gesture so it can be put back — and nothing put it back,
 * so every way of abandoning the gesture destroyed a connection the user never
 * asked to remove. Two of those paths even announced "connection cancelled"
 * while the connection was gone.
 *
 * On a touch device a port row is 44 world units tall, so most of a card's
 * left edge detaches a wire on contact. That is how a 96,000-connection board
 * was observed becoming 95,999: a press near the edge, then a second finger.
 */
describe('a wire unplugged by a gesture that is then abandoned comes back', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    const settle = (): Promise<void> => settleFixture(fixture);
    const portEl = (node: string, port: string): HTMLElement => findPort(fixture, node, port);

    /** Presses the occupied input, which detaches the wire on contact. */
    async function unplug(): Promise<void> {
        dispatchTouch(portEl('b', 'in'), 'pointerdown', {
            pointerId: 1,
            isPrimary: true,
            clientX: 60,
            clientY: 260,
        });
        await settle();
        expect(host.connections()).toHaveLength(0);
    }

    /*
     * The EDITOR element, not the fixture's. Both handlers live on the
     * editor's own host — the second-finger check on its `pointerdown`, the
     * Escape on a capture listener it adds to itself — and an event dispatched
     * on the parent never reaches a child. Aiming at the fixture made both
     * tests pass for the wrong reason: nothing ran at all.
     */
    function editorEl(): HTMLElement {
        return fixture.nativeElement.querySelector('ui-node-editor');
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        host.connections.set([
            { id: 'a->b', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' },
        ]);
        await settle();
        expect(host.connections()).toHaveLength(1);
    });

    afterEach(() => fixture.destroy());

    it('comes back when a second finger takes over', async () => {
        await unplug();

        dispatchTouch(editorEl(), 'pointerdown', {
            pointerId: 2,
            isPrimary: false,
            clientX: 200,
            clientY: 200,
        });
        await settle();

        expect(host.connections()).toHaveLength(1);
        expect(host.connections()[0].id).toBe('a->b');
    });

    it('comes back when the system cancels the pointer', async () => {
        await unplug();

        dispatchTouch(portEl('b', 'in'), 'pointercancel', { pointerId: 1, isPrimary: true });
        await settle();

        expect(host.connections()).toHaveLength(1);
    });

    it('comes back on Escape', async () => {
        await unplug();

        editorEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settle();

        expect(host.connections()).toHaveLength(1);
    });
});
