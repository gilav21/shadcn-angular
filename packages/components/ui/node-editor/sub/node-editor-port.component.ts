import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../../lib/utils';
import { portOffsetTop, type PortMetrics } from '../node-editor.layout';
import type { EditorNode, NodePort } from '../node-editor.types';

/** How a port looks while a connection is being dragged over it. */
export type PortDropState = 'valid' | 'invalid' | null;

/**
 * One connection point on a node.
 *
 * ### Why the whole row is the button
 *
 * The dot renders at 10px, which is nowhere near a usable tap target. The tap
 * target is therefore the entire row — dot *and* label — which is as tall as
 * `metrics.rowHeight` (44px on touch, per CLAUDE.md §6) and comfortably wide.
 * Enlarging an invisible hit area around the dot instead would let adjacent
 * ports overlap and steal each other's taps.
 *
 * ### Why it is positioned absolutely rather than laid out in flow
 *
 * The edge that meets this port is painted on a canvas, from a world-space
 * anchor computed by `portOffsetTop`. If the dot's position came from normal
 * flow instead, the two would be independent derivations of the same number
 * and would eventually disagree. So the dot is placed *at* the anchor.
 *
 * The port does not handle its own events: the editor delegates from its root,
 * because these elements are created and recycled by the canvas's view pool.
 */
@Component({
  selector: 'ui-node-editor-port',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './node-editor-port.component.html',
  host: { class: 'contents' },
})
export class NodeEditorPortComponent {
  readonly port = input.required<NodePort>();
  /** The node this port belongs to — supplies the id and the layout geometry. */
  readonly node = input.required<EditorNode>();
  readonly metrics = input.required<PortMetrics>();
  /** Whether at least one connection already reaches this port. */
  readonly connected = input(false);
  /** Set while a connection is being dragged over this port. */
  readonly dropState = input<PortDropState>(null);
  /** Set while this is the keyboard's current port within a focused node. */
  readonly active = input(false);
  readonly class = input('');

  protected readonly isOutput = computed(() => this.port().direction === 'out');

  /** The row's top edge: the anchor, less half a row. */
  protected readonly top = computed(() => {
    const centre = portOffsetTop(this.node(), this.port().id, this.metrics());
    return (centre ?? 0) - this.metrics().rowHeight / 2;
  });

  protected readonly rowClasses = computed(() =>
    cn(
      'absolute flex items-center gap-1.5 rounded-sm px-1 outline-none',
      'text-[11px] leading-none text-muted-foreground',
      'focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:cursor-not-allowed disabled:opacity-40',
      // Overhangs the card edge by half a dot, so the dot's centre lands
      // exactly on the node boundary where the edge anchor is.
      this.isOutput() ? 'end-[-5px] flex-row-reverse' : 'start-[-5px]',
      this.active() && 'ring-2 ring-ring',
      this.class(),
    ),
  );

  protected readonly dotClasses = computed(() => {
    const state = this.dropState();
    return cn(
      'size-2.5 shrink-0 rounded-full border-2 border-background ring-1 transition-colors',
      this.connected() ? 'bg-primary ring-primary' : 'bg-muted-foreground/40 ring-border',
      state === 'valid' && 'scale-125 bg-primary ring-primary',
      state === 'invalid' && 'scale-125 bg-destructive ring-destructive',
    );
  });

  /**
   * The port's accessible name.
   *
   * Says the direction and whether it is connected, because a screen-reader
   * user cannot see which side of the card the dot is on — which is the only
   * thing distinguishing an input from an output visually.
   */
  protected readonly ariaLabel = computed(() => {
    const port = this.port();
    const direction = this.isOutput() ? 'output' : 'input';
    const state = this.connected() ? 'connected' : 'not connected';
    const type = port.type ? `, type ${port.type}` : '';
    return `${port.label}, ${direction}${type}, ${state}`;
  });
}
