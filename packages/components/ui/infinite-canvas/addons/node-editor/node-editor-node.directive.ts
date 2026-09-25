import { Directive, input } from '@angular/core';
import type { EditorNode } from './node-editor.types';

/** Context handed to the projected node template. */
export interface NodeEditorNodeContext<T extends EditorNode = EditorNode> {
  $implicit: T;
}

/**
 * Marks the template that replaces a node card's default header.
 *
 * A `TemplateRef` rather than static content projection, for the same reason
 * the canvas engine uses one: nodes are instantiated per *visible* node and
 * recycled as the viewport moves, so there is no single place to project into.
 *
 * The template replaces the card's **body**. Ports keep being rendered and
 * wired by the editor — see `NodeEditorNodeComponent`.
 *
 * ### How tall the node gets
 *
 * The editor MEASURES the rendered body and grows the node to fit it, so a
 * projected template needs no height declared for it and none passed in. Do
 * not call `withDerivedHeights` on the nodes first — the editor derives every
 * node's height from its own `nodes()` regardless, so a height computed
 * outside is replaced on the way in.
 *
 * Size the template by its content and give it its own padding. Filling the
 * card with `h-full` does not work, deliberately: the body area is as tall as
 * its content, because a body that filled the card would measure the card's
 * own spare room and could then grow but never shrink back. No padding is
 * imposed either — a projected body is yours, and a table usually wants to run
 * edge to edge.
 *
 * Set `bodyHeight` on a node as a FLOOR, for a body that should keep a minimum
 * size even when its content is smaller. The node takes whichever is larger.
 *
 * @example
 * ```html
 * <ui-node-editor [nodes]="nodes()" [connections]="connections()">
 *   <ng-template uiNodeEditorNode [ofType]="nodes()" let-node>
 *     <my-fancy-node [data]="node" />
 *   </ng-template>
 * </ui-node-editor>
 * ```
 */
@Directive({
  selector: '[uiNodeEditorNode]',
  standalone: true,
})
export class NodeEditorNodeDirective<T extends EditorNode = EditorNode> {
  /**
   * Type-inference anchor. Bind the same array passed to the editor's `nodes`
   * and the template variables take that element type; the value itself is
   * never read. Mirrors `uiInfiniteCanvasItem`'s `ofType`.
   */
  readonly ofType = input<readonly T[] | undefined>(undefined);

  /* eslint-disable @typescript-eslint/no-unused-vars -- dir and ctx required by Angular's type-narrowing contract */
  static ngTemplateContextGuard<T extends EditorNode>(
    dir: NodeEditorNodeDirective<T>,
    ctx: unknown,
  ): ctx is NodeEditorNodeContext<T> {
    return true;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
