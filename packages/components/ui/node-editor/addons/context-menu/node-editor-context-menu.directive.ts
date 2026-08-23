import { Directive, ElementRef, inject, input, output, DestroyRef } from '@angular/core';
import { ContextMenuComponent } from '../../../context-menu';
import { NodeEditorComponent } from '../..';
import type { NodeEditorContextTarget } from './node-editor-context-menu.types';
import { resolveTarget } from './node-editor-context-menu.resolve';

/**
 * A context menu on the graph, with contents that depend on what was clicked.
 *
 * ### Why a directive, and why on the editor element
 *
 * It follows the convention already in this repo — `uiTreeContextMenu`,
 * `uiTableContextMenu`, `uiDataTableContextMenu` all attach a
 * {@link ContextMenuComponent} to a host and hand it the thing under the
 * pointer. A node graph is the same problem with a richer answer.
 *
 * Sitting on `ui-node-editor` lets it inject the editor, which is the only
 * thing that can say what is under a screen point: node cards and ports are
 * real elements, but connections are painted into one shared canvas, so no
 * amount of DOM walking finds a wire.
 *
 * ### What it does NOT do
 *
 * It does not decide what the menu contains. The target it publishes carries
 * the node, the port and the connection themselves, and the consumer writes
 * the items — which is what makes "options per what you right-click" the
 * consumer's vocabulary rather than a fixed list baked in here.
 *
 * @example
 * ```html
 * <ui-node-editor [uiNodeEditorContextMenu]="menu" />
 *
 * <ui-context-menu #menu>
 *   @if (menu.data(); as target) {
 *     @switch (target.kind) {
 *       @case ('canvas') { <ui-context-menu-item (select)="add(target.at)">Add node…</ui-context-menu-item> }
 *       @case ('node')   { <ui-context-menu-item (select)="rename(target.node)">Rename…</ui-context-menu-item> }
 *     }
 *   }
 * </ui-context-menu>
 * ```
 */
@Directive({
  selector: 'ui-node-editor[uiNodeEditorContextMenu]',
  standalone: true,
})
export class NodeEditorContextMenuDirective {
  /** The menu to open. Template-reference it: `[uiNodeEditorContextMenu]="menu"`. */
  readonly uiNodeEditorContextMenu = input.required<ContextMenuComponent>();
  readonly contextMenuDisabled = input(false);

  /** Fires with the resolved target, whether or not a menu is attached. */
  readonly contextTarget = output<NodeEditorContextTarget>();

  private readonly editor = inject(NodeEditorComponent);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const element = this.host.nativeElement;
    element.addEventListener('contextmenu', this.onContextMenu);
    inject(DestroyRef).onDestroy(() =>
      element.removeEventListener('contextmenu', this.onContextMenu),
    );
  }

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.contextMenuDisabled()) return;

    const target = resolveTarget(event, this.editor);
    if (!target) return;

    /*
     * The browser's own menu is suppressed only once we have something better
     * to show. A right-click that resolves to nothing — on a scrollbar inside
     * a node's view, say — keeps the native menu, because taking it away and
     * offering nothing is worse than either.
     */
    event.preventDefault();
    event.stopPropagation();

    this.contextTarget.emit(target);
    this.uiNodeEditorContextMenu().show(target.screen.x, target.screen.y, target);
  };
}
