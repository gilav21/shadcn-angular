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

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

describe('a second finger takes over from an edit', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await nextFrame();
        fixture.detectChanges();
    }

    function nodeEl(id: string): HTMLElement {
        return fixture.nativeElement.querySelector(
            `[data-slot="node-editor-node"][data-node="${id}"]`,
        );
    }

    function portEl(node: string, port: string): HTMLElement {
        return fixture.nativeElement.querySelector(
            `[data-slot="node-editor-port"][data-node="${node}"][data-port="${port}"]`,
        );
    }

    /** A touch. `isPrimary` is what distinguishes the first finger. */
    function touch(
        target: EventTarget,
        type: string,
        init: PointerEventInit & { isPrimary?: boolean },
    ): void {
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

    function positionOf(id: string): { x: number; y: number } {
        const node = host.nodes().find(candidate => candidate.id === id);
        return { x: node?.x ?? 0, y: node?.y ?? 0 };
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
        const before = positionOf('a');

        touch(nodeEl('a'), 'pointerdown', { pointerId: 1, isPrimary: true, clientX: 50, clientY: 50 });
        touch(nodeEl('a'), 'pointermove', { pointerId: 1, isPrimary: true, clientX: 220, clientY: 180 });
        await settle();
        expect(positionOf('a')).not.toEqual(before);

        // The pinch begins.
        touch(nodeEl('b'), 'pointerdown', { pointerId: 2, isPrimary: false, clientX: 300, clientY: 300 });
        await settle();

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
        const before = positionOf('a');

        nodeEl('a').dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, cancelable: true, button: 0, pointerId: 1,
            pointerType: 'mouse', clientX: 50, clientY: 50,
        }));
        nodeEl('a').dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true, cancelable: true, pointerId: 1,
            pointerType: 'mouse', clientX: 200, clientY: 170,
        }));
        await settle();

        expect(positionOf('a')).not.toEqual(before);
    });
});
