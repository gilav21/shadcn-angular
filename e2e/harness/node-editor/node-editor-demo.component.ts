import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
    NODE_CONTEXT,
    NodeEditorComponent,
    type EditorNode,
    type NodeConnection,
    type NodeContext,
    type NodeTypeDefinition,
} from '@/components/ui/infinite-canvas/addons/node-editor';

/**
 * Harness for the `node-editor` component.
 *
 * Deliberately NOT the scaffolder's default shape: `ui-node-editor-node` and
 * `ui-node-editor-port` take required inputs and are rendered by the editor
 * into the canvas's virtualised item layer. Placing them as static content
 * would not compile, and would not be how anyone uses this component.
 *
 * Two graphs are exercised, because they fail differently:
 *
 *  - a **structural** one — ports and connections only, no runtime
 *  - a **runtime** one — typed nodes with views, where a value typed into one
 *    node has to reach the far end of the graph
 */

interface TextState {
    value: string;
}

@Component({
    selector: 'app-e2e-text-node',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <input
            data-testid="rt-input"
            [value]="ctx.state().value"
            (input)="onInput($event)"
        />
    `,
})
export class E2eTextNodeComponent {
    readonly ctx = inject(NODE_CONTEXT) as NodeContext<TextState>;
    protected onInput(event: Event): void {
        this.ctx.setState({ value: (event.target as HTMLInputElement).value });
    }
}

@Component({
    selector: 'app-e2e-readout-node',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<span data-testid="rt-output">{{ shown() }}</span>`,
})
export class E2eReadoutNodeComponent {
    private readonly ctx = inject(NODE_CONTEXT);
    private readonly value = this.ctx.input<string>('value');
    protected readonly shown = computed(() => this.value() ?? '-');
}

const TEXT_TYPE: NodeTypeDefinition<TextState> = {
    id: 'text',
    label: 'Text',
    ports: [{ id: 'out', direction: 'out', label: 'Text', type: 'text' }],
    initialState: () => ({ value: '' }),
    view: E2eTextNodeComponent,
    bodyHeight: 46,
    compute: (_inputs, ctx) => ({ out: ctx.state.value }),
};

const UPPER_TYPE: NodeTypeDefinition = {
    id: 'upper',
    label: 'Uppercase',
    ports: [
        { id: 'in', direction: 'in', label: 'In', type: 'text' },
        { id: 'out', direction: 'out', label: 'Out', type: 'text' },
    ],
    compute: inputs => ({ out: String(inputs['in'] ?? '').toUpperCase() }),
};

const READOUT_TYPE: NodeTypeDefinition = {
    id: 'readout',
    label: 'Readout',
    ports: [{ id: 'value', direction: 'in', label: 'Value', type: 'text', required: true }],
    view: E2eReadoutNodeComponent,
    bodyHeight: 46,
};

@Component({
    selector: 'app-node-editor-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NodeEditorComponent],
    template: `
        <main class="p-8">
            <ui-node-editor
                data-testid="root"
                class="h-[420px] w-[900px]"
                [(nodes)]="nodes"
                [(connections)]="connections"
                [allowCycles]="false"
                (connectionRejected)="rejection.set($event.reason)"
            />

            <p data-testid="node-count">{{ nodes().length }}</p>
            <p data-testid="connection-count">{{ connections().length }}</p>
            <p data-testid="rejection">{{ rejection() ?? 'none' }}</p>
            <p data-testid="alpha-x">{{ nodes()[0].x }}</p>

            <hr />

            <ui-node-editor
                data-testid="runtime-root"
                class="h-[420px] w-[900px]"
                [(nodes)]="runtimeNodes"
                [(connections)]="runtimeConnections"
                [definitions]="definitions"
            />
        </main>
    `,
})
export class NodeEditorDemoComponent {
    readonly nodes = signal<readonly EditorNode[]>([
        {
            id: 'alpha',
            x: 40,
            y: 40,
            width: 190,
            height: 0,
            title: 'Alpha',
            ports: [
                { id: 'in', direction: 'in', label: 'In' },
                { id: 'out', direction: 'out', label: 'Out' },
            ],
        },
        {
            id: 'beta',
            x: 400,
            y: 40,
            width: 190,
            height: 0,
            title: 'Beta',
            ports: [
                { id: 'in', direction: 'in', label: 'In' },
                { id: 'out', direction: 'out', label: 'Out' },
            ],
        },
    ]);

    readonly connections = signal<readonly NodeConnection[]>([]);
    readonly rejection = signal<string | null>(null);

    // ---- the runtime graph -------------------------------------------------

    readonly definitions = [TEXT_TYPE, UPPER_TYPE, READOUT_TYPE];

    /** Authored with no title and no ports — both come from the definition. */
    readonly runtimeNodes = signal<readonly EditorNode[]>([
        { id: 't', type: 'text', x: 20, y: 20, width: 180, height: 0 },
        { id: 'u', type: 'upper', x: 260, y: 20, width: 180, height: 0 },
        { id: 'r', type: 'readout', x: 500, y: 20, width: 180, height: 0 },
    ]);

    readonly runtimeConnections = signal<readonly NodeConnection[]>([
        { id: 'rt1', source: 't', sourcePort: 'out', target: 'u', targetPort: 'in' },
        { id: 'rt2', source: 'u', sourcePort: 'out', target: 'r', targetPort: 'value' },
    ]);
}
