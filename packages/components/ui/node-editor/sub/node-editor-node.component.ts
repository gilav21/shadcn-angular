import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  type Injector,
  type TemplateRef,
  type Type,
} from '@angular/core';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { cn } from '../../../lib/utils';
import { NODE_HEADER_HEIGHT, portRowsHeight, type PortMetrics } from '../node-editor.layout';
import type { NodeStatus } from '../node-editor.runtime.types';
import type { EditorNode, PortRef } from '../node-editor.types';
import { NodeEditorPortComponent, type PortDropState } from './node-editor-port.component';

/** Context handed to a projected node template. */
export interface NodeTemplateContext {
  $implicit: EditorNode;
}

/**
 * One node card on the plane.
 *
 * The card body is replaceable — project a `*uiNodeEditorNode` template and it
 * renders in place of the default header. **The ports are not replaceable**:
 * a projected template that rendered its own ports would have to re-derive the
 * layout maths that keeps the dot and the wire together, and would get it
 * wrong. So the editor keeps them in both modes.
 *
 * Like the port, this component handles no events of its own — the editor
 * delegates from its root, because the canvas's view pool creates and recycles
 * these elements outside any single binding scope.
 */
@Component({
  selector: 'ui-node-editor-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet, NgTemplateOutlet, NodeEditorPortComponent],
  templateUrl: './node-editor-node.component.html',
  host: { class: 'contents' },
})
export class NodeEditorNodeComponent {
  readonly node = input.required<EditorNode>();
  readonly metrics = input.required<PortMetrics>();
  readonly selected = input(false);
  /** Whether this node holds the roving tab stop. */
  readonly focused = input(false);
  /** Ports that already have at least one connection. */
  readonly connectedPorts = input<ReadonlySet<string>>(new Set<string>());
  /** The port a connection is currently being dragged over, if it is on this node. */
  readonly dropPort = input<PortRef | null>(null);
  /** Whether dropping on {@link dropPort} would be accepted. */
  readonly dropValid = input(false);
  /** The port the keyboard is currently on within this node. */
  readonly activePort = input<string | null>(null);
  /** Optional replacement for the default header. */
  readonly bodyTemplate = input<TemplateRef<NodeTemplateContext> | null>(null);
  /** The node type's view component, rendered inside the card. */
  readonly view = input<Type<unknown> | null>(null);
  /** Injector carrying this node's NODE_CONTEXT to that view. */
  readonly viewInjector = input<Injector | null>(null);
  /** Runtime status, surfaced on the card so a run is visible. */
  readonly status = input<NodeStatus | null>(null);
  /** Ports that would accept the connection in flight; passed straight down. */
  readonly connectable = input<ReadonlySet<string> | null>(null);
  readonly class = input('');

  protected readonly headerHeight = NODE_HEADER_HEIGHT;

  /**
   * The vertical band the ports occupy.
   *
   * Ports are absolutely positioned siblings of the card, so without a spacer
   * of exactly this height the card's body renders UNDERNEATH them — which is
   * what the first live demo screenshot showed: port labels sitting on top of
   * a text field and a value display.
   */
  protected readonly portBandHeight = computed(() =>
    portRowsHeight(this.node(), this.metrics()),
  );

  /**
   * Whether someone other than the editor owns this card's body.
   *
   * A projected template or a node type's view may both contain the
   * consumer's own controls, so neither may be wrapped in a <button> — see
   * the template.
   */
  /**
   * Short status text in the header, or `null` when there is nothing to say.
   *
   * `idle` and `done` are the resting states of a healthy graph, and labelling
   * every node in a large graph "done" is noise rather than information.
   */
  protected readonly statusLabel = computed(() => {
    const status = this.status();
    if (status === null || status === 'idle' || status === 'done') return null;
    return status;
  });

  protected readonly bodyIsForeign = computed(
    () => this.bodyTemplate() !== null || this.view() !== null,
  );

  protected readonly cardClasses = computed(() =>
    cn(
      'relative h-full w-full overflow-visible rounded-lg border bg-card text-card-foreground shadow-sm',
      // The default card is a real <button>, so the UA's own button styling has
      // to be neutralised: it would otherwise impose its font and centre the text.
      'appearance-none text-start font-[inherit]',
      'transition-[box-shadow,border-color]',
      this.selected() ? 'border-primary ring-2 ring-primary/40' : 'border-border',
      this.node().locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      this.class(),
    ),
  );

  /**
   * The card's accessible name.
   *
   * The full graph structure lives in the editor's parallel accessible model;
   * this is the spatial view's short label, so it states only what a sighted
   * user reads off the card plus the state they see.
   */
  protected readonly ariaLabel = computed(() => {
    const node = this.node();
    const parts = [node.title];
    if (node.subtitle) parts.push(node.subtitle);
    if (node.locked) parts.push('locked');
    return parts.join(', ');
  });

  /**
   * The projected variant is a `<fieldset>`, which brings UA margin, padding
   * and — the one that actually bites — `min-inline-size: min-content`.
   */
  protected readonly projectedCardClasses = computed(() =>
    cn(this.cardClasses(), 'm-0 min-w-0 p-0'),
  );

  protected dropStateFor(portId: string): PortDropState {
    const over = this.dropPort();
    if (over?.node !== this.node().id || over.port !== portId) return null;
    return this.dropValid() ? 'valid' : 'invalid';
  }
}
