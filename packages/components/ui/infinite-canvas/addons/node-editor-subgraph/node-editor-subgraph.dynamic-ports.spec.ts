// A subgraph the USER built, mounted in a real editor.
//
// The unit tests prove `portsFor` returns the right ports. They cannot prove
// the editor DRAWS them, or that the runtime carries values through them —
// and those were two separate gaps: materialisation copied `ports` off the
// definition onto every node, and input resolution read `definition.ports`.
// Either one alone leaves a subgraph that looks right and does nothing.
//
// So this mounts the editor, grows a port by editing the node's own graph, and
// asserts on rendered DOM and on the value that comes out the far side.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
    NodeEditorComponent,
    type EditorNode,
    type NodeConnection,
    type NodeTypeDefinition,
} from '../node-editor';
import { emptySubgraphNodeType } from './node-editor-subgraph';
import {
    SUBGRAPH_INPUT_TYPE,
    SUBGRAPH_OUTPUT_TYPE,
    type SubgraphGraph,
} from './node-editor-subgraph.types';

const DOUBLE: NodeTypeDefinition = {
    id: 'double',
    label: 'Double',
    ports: [
        { id: 'in', direction: 'in', label: 'In' },
        { id: 'out', direction: 'out', label: 'Out' },
    ],
    compute: inputs => ({ out: (inputs['in'] as number) * 2 }),
};

const SOURCE: NodeTypeDefinition = {
    id: 'source',
    label: 'Source',
    ports: [{ id: 'out', direction: 'out', label: 'Out' }],
    initialState: () => 21,
    compute: (_inputs, ctx) => ({ out: ctx.state }),
};

/** The palette entry: a subgraph with nothing in it yet. */
const BLANK = emptySubgraphNodeType({
    id: 'blank',
    label: 'Subgraph',
    definitions: [DOUBLE],
});

/** What the user would end up with after building inside the empty node. */
const BUILT: SubgraphGraph = {
    nodes: [
        { id: 'n', type: SUBGRAPH_INPUT_TYPE, x: 0, y: 0, width: 170, height: 0, title: 'N' },
        { id: 'twice', type: 'double', x: 200, y: 0, width: 170, height: 0 },
        { id: 'result', type: SUBGRAPH_OUTPUT_TYPE, x: 400, y: 0, width: 170, height: 0, title: 'Result' },
    ],
    connections: [
        { id: 'i1', source: 'n', sourcePort: 'value', target: 'twice', targetPort: 'in' },
        { id: 'i2', source: 'twice', sourcePort: 'out', target: 'result', targetPort: 'value' },
    ],
};

@Component({
    standalone: true,
    imports: [NodeEditorComponent],
    template: `
    <ui-node-editor
      class="h-[500px] w-[600px]"
      [(nodes)]="nodes"
      [(connections)]="connections"
      [definitions]="definitions"
      [live]="true"
    />
  `,
})
class HostComponent {
    readonly definitions = [BLANK, DOUBLE, SOURCE];
    readonly nodes = signal<readonly EditorNode[]>([
        { id: 'src', type: 'source', x: 0, y: 0, width: 170, height: 0 },
        { id: 'sub', type: 'blank', x: 260, y: 0, width: 200, height: 0 },
    ]);
    readonly connections = signal<readonly NodeConnection[]>([]);
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

describe('a subgraph node built by the user, in a mounted editor', () => {
    let fixture: ComponentFixture<HostComponent>;

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await nextFrame();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    function editor(): NodeEditorComponent {
        return fixture.debugElement.children[0].componentInstance as NodeEditorComponent;
    }

    /**
     * Port labels actually drawn for one node.
     *
     * Queried from the ports themselves — each carries its own `data-node` —
     * rather than from inside the card, which does not contain them: the port
     * band is a sibling layer, so `card.querySelectorAll(...)` finds nothing
     * and every assertion would pass against an empty list.
     */
    function portLabels(nodeId: string): string[] {
        const ports = fixture.nativeElement.querySelectorAll(
            `[data-slot="node-editor-port"][data-node="${nodeId}"]`,
        ) as NodeListOf<HTMLElement>;
        return [...ports].map(port =>
            (port.querySelector('[data-slot="node-editor-port-label"]')?.textContent ?? '').trim(),
        );
    }

    /** Guards the guard: a selector that matches nothing must not read as "no ports". */
    function portLabelsOfEveryNode(): string[] {
        const ports = fixture.nativeElement.querySelectorAll(
            '[data-slot="node-editor-port"]',
        ) as NodeListOf<HTMLElement>;
        return [...ports].map(port => port.getAttribute('data-node') ?? '');
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        await settle();
    });

    afterEach(() => fixture.destroy());

    it('draws no ports while its graph is still empty', async () => {
        // The sibling node DOES have a port, so an empty result here is the
        // subgraph having none — not the selector silently matching nothing.
        expect(portLabelsOfEveryNode()).toContain('src');
        expect(portLabels('sub')).toEqual([]);
    });

    it('draws a port on the card once a boundary node is added inside', async () => {
        editor().runtime.setState('sub', BUILT);
        await settle();

        expect(portLabels('sub')).toEqual(['N', 'Result']);
    });

    /*
     * The half that rendering alone would hide: the runtime resolved inputs
     * from `definition.ports`, which for this type is empty forever. The card
     * showed "N" and nothing ever arrived at it.
     */
    it('carries a value through the port it grew', async () => {
        editor().runtime.setState('sub', BUILT);
        await settle();

        fixture.componentInstance.connections.set([
            { id: 'c1', source: 'src', sourcePort: 'out', target: 'sub', targetPort: 'n' },
        ]);
        await settle();
        await editor().runtime.run();
        await settle();

        expect(editor().runtime.outputs('sub')()['result']).toBe(42);
    });

    it('lets two nodes of the same type carry different ports', async () => {
        fixture.componentInstance.nodes.update(nodes => [
            ...nodes,
            { id: 'other', type: 'blank', x: 260, y: 300, width: 200, height: 0 },
        ]);
        await settle();

        editor().runtime.setState('sub', BUILT);
        editor().runtime.setState('other', {
            nodes: [
                { id: 'only', type: SUBGRAPH_INPUT_TYPE, x: 0, y: 0, width: 170, height: 0, title: 'Only' },
            ],
            connections: [],
        } satisfies SubgraphGraph);
        await settle();

        expect(portLabels('sub')).toEqual(['N', 'Result']);
        expect(portLabels('other')).toEqual(['Only']);
    });
});
