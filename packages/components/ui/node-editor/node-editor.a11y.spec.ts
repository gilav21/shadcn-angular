// T-10 from `specs/node-editor-spec.md` §6 — the parallel accessible model.
//
// Axe runs here rather than only through the Storybook runner, for the reason
// documented at length in `infinite-canvas.a11y.spec.ts`: that runner's glob
// silently matches zero files under a Windows worktree path. Same axe-core,
// same unweakened default ruleset.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { NodeEditorComponent } from './node-editor.component';
import type { EditorNode, NodeConnection } from './node-editor.types';

const NODES: EditorNode[] = [
    {
        id: 'source',
        x: 0,
        y: 0,
        width: 180,
        height: 0,
        title: 'Read file',
        subtitle: 'input',
        accent: '#22c55e',
        ports: [{ id: 'out', direction: 'out', label: 'Contents', type: 'text' }],
    },
    {
        id: 'transform',
        x: 300,
        y: 0,
        width: 180,
        height: 0,
        title: 'Uppercase',
        ports: [
            { id: 'in', direction: 'in', label: 'Text', type: 'text' },
            { id: 'out', direction: 'out', label: 'Result', type: 'text' },
        ],
    },
    {
        id: 'sink',
        x: 600,
        y: 0,
        width: 180,
        height: 0,
        title: 'Write file',
        locked: true,
        ports: [{ id: 'in', direction: 'in', label: 'Text', type: 'text' }],
    },
];

const CONNECTIONS: NodeConnection[] = [
    { id: '1', source: 'source', sourcePort: 'out', target: 'transform', targetPort: 'in' },
    { id: '2', source: 'transform', sourcePort: 'out', target: 'sink', targetPort: 'in' },
];

@Component({
    standalone: true,
    imports: [NodeEditorComponent],
    template: `
    <ui-node-editor
      class="h-[400px] w-[900px]"
      [nodes]="nodes()"
      [connections]="connections()"
      [a11yTreeLimit]="limit()"
      ariaLabel="Pipeline"
    />
  `,
})
class A11yHostComponent {
    readonly nodes = signal<readonly EditorNode[]>(NODES);
    readonly connections = signal<readonly NodeConnection[]>(CONNECTIONS);
    readonly limit = signal(500);
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

async function audit(root: HTMLElement): Promise<string[]> {
    const results = await axe.run(root, { resultTypes: ['violations'] });
    return results.violations.map(
        v => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`,
    );
}

describe('NodeEditorComponent accessibility (T-10)', () => {
    let fixture: ComponentFixture<A11yHostComponent>;
    let host: A11yHostComponent;
    let root: HTMLElement;

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await nextFrame();
        fixture.detectChanges();
    }

    function tree(): HTMLElement {
        return root.querySelector('[data-slot="node-editor-a11y-tree"]') as HTMLElement;
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [A11yHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(A11yHostComponent);
        host = fixture.componentInstance;
        await settle();
        root = fixture.nativeElement.querySelector('[data-slot="node-editor"]') as HTMLElement;
        await settle();
    });

    afterEach(() => fixture.destroy());

    describe('axe', () => {
        it('has no violations with a populated graph', async () => {
            expect(await audit(root)).toEqual([]);
        });

        it('has no violations when empty', async () => {
            host.nodes.set([]);
            host.connections.set([]);
            await settle();
            expect(await audit(root)).toEqual([]);
        });

        it('has no violations in an RTL container', async () => {
            (fixture.nativeElement as HTMLElement).setAttribute('dir', 'rtl');
            await settle();
            expect(await audit(root)).toEqual([]);
        });

        it('has no violations while a connection is being dragged', async () => {
            const port = root.querySelector<HTMLElement>(
                '[data-slot="node-editor-port"][data-node="source"]',
            );
            port?.dispatchEvent(
                new PointerEvent('pointerdown', {
                    bubbles: true, cancelable: true, pointerId: 1, clientX: 10, clientY: 10,
                }),
            );
            await settle();
            expect(await audit(root)).toEqual([]);
        });
    });

    describe('the parallel accessible model mirrors the WHOLE graph', () => {
        it('lists every node, including any the viewport has culled', () => {
            const text = tree().textContent ?? '';
            for (const node of NODES) expect(text).toContain(node.title);
        });

        it('is a real list, so a screen reader can traverse it structurally', () => {
            // Not a paragraph of prose: the point is navigable structure.
            expect(tree().querySelectorAll('ul').length).toBeGreaterThan(1);
            expect(tree().querySelectorAll('li').length).toBeGreaterThanOrEqual(NODES.length);
        });

        it('names what each port connects TO, not merely that it is connected', () => {
            // "connected" alone would leave a screen-reader user unable to read
            // the graph's shape, which is the only thing the spatial view shows.
            expect(tree().textContent).toContain('Uppercase, in');
        });

        it('says when a port is not connected', async () => {
            host.connections.set([]);
            await settle();
            expect(tree().textContent).toContain('not connected');
        });

        it('distinguishes inputs from outputs, which the visual only shows by side', () => {
            const text = tree().textContent ?? '';
            expect(text).toContain('output');
            expect(text).toContain('input');
        });

        it('stays in sync when the graph changes', async () => {
            host.nodes.set([...NODES, {
                id: 'extra', x: 0, y: 400, width: 180, height: 0,
                title: 'Log to console', ports: [{ id: 'in', direction: 'in', label: 'Any' }],
            }]);
            await settle();
            expect(tree().textContent).toContain('Log to console');
        });

        it('is visually hidden but present in the accessibility tree', () => {
            expect(tree().className).toContain('sr-only');
            expect(tree().getAttribute('aria-hidden')).toBeNull();
        });
    });

    describe('the tree is bounded, because it is the one thing that cannot virtualise', () => {
        it('summarises instead of listing once the graph is too large', async () => {
            host.limit.set(2);
            await settle();

            expect(tree().querySelector('ul')).toBeNull();
            expect(tree().textContent).toContain('3 nodes');
            expect(tree().textContent).toContain('2 connections');
        });
    });

    describe('the spatial view carries its own labels', () => {
        it('names each card', () => {
            const card = root.querySelector('[data-slot="node-editor-node"][data-node="source"]');
            expect(card?.getAttribute('aria-label')).toContain('Read file');
        });

        it('says a locked node is locked', () => {
            const card = root.querySelector('[data-slot="node-editor-node"][data-node="sink"]');
            expect(card?.getAttribute('aria-label')).toContain('locked');
        });

        it('exposes selection state on the card', () => {
            const card = root.querySelector('[data-slot="node-editor-node"][data-node="source"]');
            expect(card?.getAttribute('aria-pressed')).toBe('false');
        });

        it('names each port with its direction and connection state', () => {
            const port = root.querySelector(
                '[data-slot="node-editor-port"][data-node="transform"][data-port="in"]',
            );
            const label = port?.getAttribute('aria-label') ?? '';
            expect(label).toContain('Text');
            expect(label).toContain('input');
            expect(label).toContain('connected');
        });

        it('states the port type, which is what makes a target valid or not', () => {
            const port = root.querySelector(
                '[data-slot="node-editor-port"][data-node="source"][data-port="out"]',
            );
            expect(port?.getAttribute('aria-label')).toContain('type text');
        });

        it('keeps exactly one roving tab stop', async () => {
            const card = root.querySelector<HTMLElement>(
                '[data-slot="node-editor-node"][data-node="source"]',
            );
            card?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            await settle();

            const stops = [...root.querySelectorAll('[data-slot="node-editor-node"]')].filter(
                el => el.getAttribute('tabindex') === '0',
            );
            expect(stops).toHaveLength(1);
        });

        it('keeps the decorative pending overlay out of the accessibility tree', async () => {
            const port = root.querySelector<HTMLElement>(
                '[data-slot="node-editor-port"][data-node="source"]',
            );
            port?.dispatchEvent(
                new PointerEvent('pointerdown', {
                    bubbles: true, cancelable: true, pointerId: 1, clientX: 10, clientY: 10,
                }),
            );
            await settle();

            const overlay = root.querySelector('[data-slot="node-editor-pending"]');
            expect(overlay?.getAttribute('aria-hidden')).toBe('true');
        });
    });

    describe('touch targets', () => {
        it('makes the whole port row the tap target, not the 10px dot', () => {
            const port = root.querySelector<HTMLElement>(
                '[data-slot="node-editor-port"][data-node="transform"][data-port="in"]',
            );
            const dot = port?.querySelector<HTMLElement>('[data-slot="node-editor-port-dot"]');
            const portBox = port?.getBoundingClientRect();
            const dotBox = dot?.getBoundingClientRect();

            expect(portBox?.height ?? 0).toBeGreaterThan(dotBox?.height ?? 0);
            expect(portBox?.width ?? 0).toBeGreaterThan(dotBox?.width ?? 0);
        });
    });
});
