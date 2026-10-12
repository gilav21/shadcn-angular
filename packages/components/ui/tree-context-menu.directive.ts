import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { onContextGesture, type ContextGesture } from '../lib/touch';
import { ContextMenuComponent } from './context-menu';

export interface TreeContextMenuEvent<T = unknown> {
  node: T;
  /** The `contextmenu` event of a right-click or the keyboard key, or the `touchstart` that began a long-press. */
  event: MouseEvent | TouchEvent;
}

/**
 * Attach a context menu to a `<ui-tree>` element. Right-clicking, pressing the
 * context-menu key on, or long-pressing a tree item
 * opens the provided {@link ContextMenuComponent} at the cursor position and
 * emits {@link TreeContextMenuEvent} with the node data extracted from the DOM:
 * `{ key, label, expanded, selected, element }`, where `key` is the item's
 * `value` (its `data-key`), `label` its own `<ui-tree-label>` text, and
 * `expanded` / `selected` its current state.
 */
@Directive({
  selector: 'ui-tree[uiTreeContextMenu]',
  standalone: true,
})
export class TreeContextMenuDirective<T = unknown> {
  /** The menu to open when a node is right-clicked or long-pressed. */
  uiTreeContextMenu = input.required<ContextMenuComponent>();
  /** Stops the tree from opening the menu. */
  contextMenuDisabled = input<boolean>(false);

  /** Emits the node that was right-clicked or long-pressed. */
  nodeContextMenu = output<TreeContextMenuEvent<T>>();

  constructor() {
    const stop = onContextGesture(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement, (gesture) => this.open(gesture));
    inject(DestroyRef).onDestroy(stop);
  }

  /** Whether the gesture landed on a tree item and was taken. */
  private open(gesture: ContextGesture): boolean {
    if (this.contextMenuDisabled()) return false;

    const treeItem = gesture.target.closest<HTMLElement>('[data-slot="tree-item"]');
    if (!treeItem) return false;

    const nodeData = this.extractNodeData(treeItem);
    this.nodeContextMenu.emit({ node: nodeData, event: gesture.source });
    this.uiTreeContextMenu()?.show(gesture.clientX, gesture.clientY, nodeData);
    return true;
  }

  private extractNodeData(element: HTMLElement): T {
    const key = element.dataset['key'];
    const expanded = element.dataset['expanded'] === 'true';
    const selected = element.dataset['selected'] === 'true';

    return {
      key,
      label: this.ownLabel(element),
      expanded,
      selected,
      element,
    } as unknown as T;
  }

  /**
   * The text of the item's own label. Nested items render inside their parent's
   * row, so the first label in the subtree can belong to a child when the item
   * itself has none.
   */
  private ownLabel(item: HTMLElement): string {
    const own = Array.from(item.querySelectorAll('[data-slot="tree-label"]'))
      .find((label) => label.closest('[data-slot="tree-item"]') === item);
    return own?.textContent?.trim() ?? '';
  }
}
