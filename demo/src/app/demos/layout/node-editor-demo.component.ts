import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  ButtonComponent,
  NodeEditorComponent,
  SwitchComponent,
  type ConnectionRejectedEvent,
  type EditorNode,
  type EditorSelection,
  type NodeConnection,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { NODE_EDITOR_DEMO_LOCALES } from './node-editor-demo.locales';

/** The starting graph: an ETL pipeline, which is what node editors are for. */
function initialNodes(): EditorNode[] {
  return [
    {
      id: 'read',
      x: 0,
      y: 40,
      width: 190,
      height: 0,
      title: 'Read CSV',
      subtitle: 'source',
      accent: '#22c55e',
      ports: [{ id: 'rows', direction: 'out', label: 'Rows', type: 'table' }],
    },
    {
      id: 'filter',
      x: 290,
      y: 0,
      width: 190,
      height: 0,
      title: 'Filter',
      ports: [
        { id: 'in', direction: 'in', label: 'Rows', type: 'table' },
        { id: 'kept', direction: 'out', label: 'Kept', type: 'table' },
        { id: 'dropped', direction: 'out', label: 'Dropped', type: 'table' },
      ],
    },
    {
      id: 'lookup',
      x: 290,
      y: 220,
      width: 190,
      height: 0,
      title: 'Lookup',
      ports: [
        { id: 'in', direction: 'in', label: 'Rows', type: 'table' },
        { id: 'key', direction: 'in', label: 'Key', type: 'text' },
        { id: 'out', direction: 'out', label: 'Joined', type: 'table' },
      ],
    },
    {
      id: 'write',
      x: 600,
      y: 90,
      width: 190,
      height: 0,
      title: 'Write table',
      subtitle: 'sink',
      accent: '#3b82f6',
      ports: [{ id: 'in', direction: 'in', label: 'Rows', type: 'table', multiple: true }],
    },
    {
      id: 'audit',
      x: 600,
      y: 300,
      width: 190,
      height: 0,
      title: 'Audit log',
      subtitle: 'locked',
      locked: true,
      ports: [{ id: 'in', direction: 'in', label: 'Anything' }],
    },
  ];
}

function initialConnections(): NodeConnection[] {
  return [
    { id: '1', source: 'read', sourcePort: 'rows', target: 'filter', targetPort: 'in' },
    { id: '2', source: 'filter', sourcePort: 'kept', target: 'write', targetPort: 'in' },
    { id: '3', source: 'filter', sourcePort: 'dropped', target: 'audit', targetPort: 'in' },
  ];
}

@Component({
  selector: 'app-node-editor-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NodeEditorComponent, ButtonComponent, SwitchComponent],
  templateUrl: './node-editor-demo.component.html',
})
export class NodeEditorDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => NODE_EDITOR_DEMO_LOCALES[this.localeId()] ?? NODE_EDITOR_DEMO_LOCALES['en'],
  );

  readonly nodes = signal<readonly EditorNode[]>(initialNodes());
  readonly connections = signal<readonly NodeConnection[]>(initialConnections());
  readonly selection = signal<EditorSelection>({ nodes: [], connections: [] });

  readonly acyclic = signal(false);
  readonly snap = signal(false);
  readonly readonlyGraph = signal(false);

  /**
   * The reason the last attempt was refused.
   *
   * Surfaced rather than swallowed: a wire that simply refuses to attach, with
   * no stated reason, is the single most confusing thing a node editor can do.
   */
  readonly rejection = signal<string | null>(null);

  protected readonly gridSnap = computed(() => (this.snap() ? 24 : 0));

  protected readonly selectedCount = computed(
    () => this.selection().nodes.length + this.selection().connections.length,
  );

  protected onRejected(event: ConnectionRejectedEvent): void {
    this.rejection.set(event.reason);
  }

  protected addNode(): void {
    const index = this.nodes().length;
    this.nodes.set([
      ...this.nodes(),
      {
        id: `node-${index}-${this.nodes().reduce((max, n) => Math.max(max, n.y), 0)}`,
        x: 40,
        y: 420,
        width: 190,
        height: 0,
        title: `Step ${index + 1}`,
        ports: [
          { id: 'in', direction: 'in', label: 'In' },
          { id: 'out', direction: 'out', label: 'Out' },
        ],
      },
    ]);
  }

  protected reset(): void {
    this.nodes.set(initialNodes());
    this.connections.set(initialConnections());
    this.selection.set({ nodes: [], connections: [] });
    this.rejection.set(null);
  }
}
