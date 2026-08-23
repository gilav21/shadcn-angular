/**
 * Which graph the editor is currently showing.
 *
 * Expanding a subgraph node does not open a second editor — it swaps what the
 * one editor is looking at, and remembers the way back. That keeps every
 * feature (undo, the palette, the minimap, groups) working at every depth,
 * because there is only ever one editor.
 *
 * A plain class, not a service. `providedIn: 'root'` would give the whole
 * application one navigation stack, and two editors on a page would push each
 * other's frames — the same no-singleton rule the runtime and the run history
 * are built on.
 */
import { computed, signal, type Signal } from '@angular/core';
import type { NodeId } from '../..';
import type { SubgraphFrame, SubgraphGraph } from './node-editor-subgraph.types';

export class SubgraphNavigator {
  private readonly frames = signal<readonly SubgraphFrame[]>([]);

  constructor(root: SubgraphGraph, rootLabel = 'Main') {
    this.frames.set([{ nodeId: null, label: rootLabel, graph: root }]);
  }

  /** Root first — the breadcrumb, in reading order. */
  readonly path: Signal<readonly SubgraphFrame[]> = this.frames.asReadonly();

  /** The graph being shown. Bind the editor's nodes and connections to this. */
  readonly current: Signal<SubgraphFrame> = computed(
    () => this.frames()[this.frames().length - 1],
  );

  /** 0 at the root. */
  readonly depth: Signal<number> = computed(() => this.frames().length - 1);

  readonly canLeave: Signal<boolean> = computed(() => this.frames().length > 1);

  /** Descend into a subgraph node's graph. */
  enter(nodeId: NodeId, label: string, graph: SubgraphGraph): void {
    this.frames.update(existing => [...existing, { nodeId, label, graph }]);
  }

  /**
   * Go back up one level, returning the graph that was being edited.
   *
   * The caller writes it back into the parent node's state — the navigator
   * deliberately does not, because it has no editor and no runtime, and a
   * navigator that reached for one would stop being testable on its own.
   */
  leave(): SubgraphFrame | null {
    if (!this.canLeave()) return null;
    const leaving = this.current();
    this.frames.update(existing => existing.slice(0, -1));
    return leaving;
  }

  /** Jump to a breadcrumb entry. Index 0 is the root. */
  leaveTo(index: number): void {
    if (index < 0 || index >= this.frames().length - 1) return;
    this.frames.update(existing => existing.slice(0, index + 1));
  }

  /**
   * Replace the graph being shown, after an edit.
   *
   * The editor owns the nodes while they are on screen; this keeps the frame
   * in step so leaving carries the edits back up rather than discarding them.
   */
  update(graph: SubgraphGraph): void {
    this.frames.update(existing =>
      existing.map((frame, index) =>
        index === existing.length - 1 ? { ...frame, graph } : frame,
      ),
    );
  }
}
