// RT-13 of `specs/node-editor-runtime-spec.md` §7.
//
// The complaint this answers, verbatim: "even in the computer where it mostly
// works, I can't understand the logic of why some works, some are blocked".
//
// Two things fix that, and both are asserted here:
//   1. valid targets are obvious BEFORE the attempt — the rest dim
//   2. a refusal says WHY, in words, where the pointer is
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NodeEditorComponent } from './node-editor.component';
import { POINTER_METRICS, portAnchor } from './node-editor.layout';
import type { EditorNode, NodeConnection } from './node-editor.types';

/**
 * The demo graph from the maintainer's own report, reduced.
 *
 * `dropped` carries a table; `key` expects text. That pair was the exact one
 * they could not connect and could not find out why.
 */
function nodes(): EditorNode[] {
    return [
        {
            id: 'filter', x: 10, y: 0, width: 170, height: 0, title: 'Filter',
            ports: [
                { id: 'in', direction: 'in', label: 'Rows', type: 'table' },
                { id: 'kept', direction: 'out', label: 'Kept', type: 'table' },
                { id: 'dropped', direction: 'out', label: 'Dropped', type: 'table' },
            ],
        },
        {
            id: 'lookup', x: 10, y: 200, width: 170, height: 0, title: 'Lookup',
            ports: [
                { id: 'rows', direction: 'in', label: 'Rows', type: 'table' },
                { id: 'key', direction: 'in', label: 'Key', type: 'text' },
                { id: 'out', direction: 'out', label: 'Joined', type: 'table' },
            ],
        },
    ];
}

@Component({
    standalone: true,
    imports: [NodeEditorComponent],
    template: `
    <ui-node-editor
      class="h-[420px] w-[400px]"
      [(nodes)]="nodes"
      [(connections)]="connections"
    />
  `,
})
class HostComponent {
    readonly nodes = signal<readonly EditorNode[]>(nodes());
    readonly connections = signal<readonly NodeConnection[]>([]);
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

describe('RT-13 a refused connection explains itself', () => {
    let fixture: ComponentFixture<HostComponent>;
    let root: HTMLElement;

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await nextFrame();
        fixture.detectChanges();
    }

    function port(nodeId: string, portId: string): HTMLElement {
        const el = root.querySelector<HTMLElement>(
            '[data-slot="node-editor-port"][data-node="' + nodeId + '"][data-port="' + portId + '"]',
        );
        if (!el) throw new Error('no port ' + nodeId + '.' + portId);
        return el;
    }

    /** Screen position of a port, derived the way the editor derives it. */
    function at(nodeId: string, portId: string): { x: number; y: number } {
        const host = fixture.componentInstance;
        const node = host.nodes().find(n => n.id === nodeId) as EditorNode;
        const offset = portAnchor(node, portId, POINTER_METRICS) ?? { x: 0, y: 0 };
        const rect = root.getBoundingClientRect();
        return { x: rect.left + node.x + offset.x, y: rect.top + node.y + offset.y };
    }

    async function startDragFrom(nodeId: string, portId: string): Promise<void> {
        const from = at(nodeId, portId);
        port(nodeId, portId).dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, cancelable: true, pointerId: 1, clientX: from.x, clientY: from.y,
        }));
        await settle();
    }

    async function hover(nodeId: string, portId: string): Promise<void> {
        const over = at(nodeId, portId);
        port(nodeId, portId).dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true, cancelable: true, pointerId: 1, clientX: over.x, clientY: over.y,
        }));
        await settle();
    }

    function reason(): string {
        return root.querySelector('[data-slot="node-editor-rejection"]')?.textContent?.trim() ?? '';
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        await settle();
        root = fixture.nativeElement.querySelector('[data-slot="node-editor"]') as HTMLElement;
        await settle();
    });

    afterEach(() => fixture.destroy());

    describe('at rest, nothing is dimmed', () => {
        it('marks no port connectable or unconnectable', () => {
            for (const el of root.querySelectorAll('[data-slot="node-editor-port"]')) {
                expect(el.getAttribute('data-connectable')).toBeNull();
            }
        });

        /*
         * "Key (text)" named the type and left the reader to work out which way
         * it flowed — whether `text` was what the port WANTED or what it would
         * hand over. That is the question someone hovering a port is asking.
         */
        it('says which way the type flows, not just what it is', () => {
            expect(port('lookup', 'key').getAttribute('title')).toBe('Key: input, expects text');
            expect(port('filter', 'dropped').getAttribute('title')).toBe(
                'Dropped: output, provides table',
            );
        });
    });

    describe('while dragging, valid targets are obvious before the attempt', () => {
        it('marks a compatible input connectable', async () => {
            await startDragFrom('filter', 'dropped');
            expect(port('lookup', 'rows').dataset['connectable']).toBe('true');
        });

        it('marks an incompatible input NOT connectable', async () => {
            await startDragFrom('filter', 'dropped');
            // table -> text
            expect(port('lookup', 'key').dataset['connectable']).toBe('false');
        });

        it('marks the source node’s own ports not connectable', async () => {
            await startDragFrom('filter', 'dropped');
            expect(port('filter', 'in').dataset['connectable']).toBe('false');
        });

        it('clears the marking once the drag ends', async () => {
            await startDragFrom('filter', 'dropped');
            root.dispatchEvent(new PointerEvent('pointerup', {
                bubbles: true, cancelable: true, pointerId: 1, clientX: 5, clientY: 400,
            }));
            await settle();

            expect(port('lookup', 'key').getAttribute('data-connectable')).toBeNull();
        });
    });

    describe('a refusal says why, in words', () => {
        /** The exact pair from the report. */
        it('names BOTH types for a mismatch, not the word "type-mismatch"', async () => {
            await startDragFrom('filter', 'dropped');
            await hover('lookup', 'key');

            expect(reason()).toBe('Key expects text, but Dropped is table');
            expect(reason()).not.toContain('type-mismatch');
        });

        /*
         * The half that was wrong, and the reason the sentence is built from
         * roles instead of from the drag.
         *
         * Dragging out of the INPUT and dropping on the output is the same
         * refusal for the same reason, so it has to read the same way. It used
         * to invert - "Style is an object, Text expects text" - naming the port
         * doing the expecting second and leaving the reader to untangle which
         * end was at fault.
         */
        it('reads the same however the wire was dragged', async () => {
            await startDragFrom('filter', 'dropped');
            await hover('lookup', 'key');
            const forwards = reason();

            await startDragFrom('lookup', 'key');
            await hover('filter', 'dropped');

            expect(reason()).toBe(forwards);
            expect(reason()).toBe('Key expects text, but Dropped is table');
        });

        it('explains a same-node attempt', async () => {
            await startDragFrom('filter', 'dropped');
            await hover('filter', 'in');
            expect(reason()).toContain('cannot connect to itself');
        });

        it('says nothing at all while over a valid target', async () => {
            await startDragFrom('filter', 'dropped');
            await hover('lookup', 'rows');
            expect(reason()).toBe('');
        });

        it('says nothing when the pointer is over empty plane', async () => {
            await startDragFrom('filter', 'dropped');
            root.dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true, cancelable: true, pointerId: 1, clientX: 5, clientY: 400,
            }));
            await settle();
            expect(reason()).toBe('');
        });

        it('is hidden from screen readers, because the live region already says it', async () => {
            await startDragFrom('filter', 'dropped');
            await hover('lookup', 'key');

            const el = root.querySelector('[data-slot="node-editor-rejection"]');
            expect(el?.getAttribute('aria-hidden')).toBe('true');
        });

        it('disappears when the drag ends', async () => {
            await startDragFrom('filter', 'dropped');
            await hover('lookup', 'key');
            expect(reason()).not.toBe('');

            root.dispatchEvent(new PointerEvent('pointerup', {
                bubbles: true, cancelable: true, pointerId: 1, clientX: 5, clientY: 400,
            }));
            await settle();
            expect(reason()).toBe('');
        });
    });

    describe('what is highlighted is exactly what can be dropped on', () => {
        /**
         * The two must agree, or the highlight is a lie. Both go through the
         * same `canConnect`, and this proves it rather than assuming it.
         */
        it('every port marked connectable actually accepts the drop', async () => {
            await startDragFrom('filter', 'dropped');

            const marked = [...root.querySelectorAll<HTMLElement>('[data-slot="node-editor-port"]')]
                .filter(el => el.dataset['connectable'] === 'true');
            expect(marked.length).toBeGreaterThan(0);

            for (const el of marked) {
                await hover(el.dataset['node'] as string, el.dataset['port'] as string);
                expect(reason()).toBe('');
            }
        });

        it('every port marked unconnectable states a reason when hovered', async () => {
            await startDragFrom('filter', 'dropped');

            const marked = [...root.querySelectorAll<HTMLElement>('[data-slot="node-editor-port"]')]
                .filter(el => el.dataset['connectable'] === 'false');
            expect(marked.length).toBeGreaterThan(0);

            for (const el of marked) {
                await hover(el.dataset['node'] as string, el.dataset['port'] as string);
                expect(reason()).not.toBe('');
            }
        });
    });
});
