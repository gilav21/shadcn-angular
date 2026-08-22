import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    NodeEditorComponent,
    type EditorNode,
    type NodeConnection,
} from '@/components/ui/node-editor';

/**
 * Harness for the `node-editor` component.
 *
 * Deliberately NOT the scaffolder's default shape: `ui-node-editor-node` and
 * `ui-node-editor-port` take required inputs and are rendered by the editor
 * into the canvas's virtualised item layer. Placing them as static content
 * would not compile, and would not be how anyone uses this component.
 */
@Component({
    selector: 'app-node-editor-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NodeEditorComponent],
    template: `
        <main class="p-8">
            <ui-node-editor
                data-testid="root"
                class="h-[500px] w-[900px]"
                [(nodes)]="nodes"
                [(connections)]="connections"
                [allowCycles]="false"
                (connectionRejected)="rejection.set($event.reason)"
            />
            <p data-testid="node-count">{{ nodes().length }}</p>
            <p data-testid="connection-count">{{ connections().length }}</p>
            <p data-testid="rejection">{{ rejection() ?? 'none' }}</p>
            <p data-testid="alpha-x">{{ nodes()[0].x }}</p>
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
}
