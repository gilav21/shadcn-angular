import {
  Directive,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
} from '@angular/core';
import { ContextMenuComponent } from './context-menu';

export interface TreeContextMenuEvent<T = unknown> {
  node: T;
  event: MouseEvent;
}

/**
 * Attach a context menu to a `<ui-tree>` element. Right-clicking a tree item
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
export class TreeContextMenuDirective<T = unknown> implements OnDestroy {
  /** The menu to open when a node is right-clicked. */
  uiTreeContextMenu = input.required<ContextMenuComponent>();
  /** Stops the tree from opening the menu. */
  contextMenuDisabled = input<boolean>(false);

  /** Emits the node that was right-clicked. */
  nodeContextMenu = output<TreeContextMenuEvent<T>>();

  private readonly treeElement = inject(ElementRef<HTMLElement>);
  private readonly contextMenuListener = (event: MouseEvent): void => {
    if (this.contextMenuDisabled()) {
      return;
    }

    const target = event.target as HTMLElement;
    const treeItem = target.closest('[data-slot="tree-item"]');

    if (treeItem) {
      event.preventDefault();
      event.stopPropagation();

      const nodeData = this.extractNodeData(treeItem as HTMLElement);

      this.nodeContextMenu.emit({
        node: nodeData,
        event,
      });

      const contextMenu = this.uiTreeContextMenu();
      if (contextMenu) {
        contextMenu.show(event.clientX, event.clientY, nodeData);
      }
    }
  };

  constructor() {
    this.treeElement.nativeElement.addEventListener('contextmenu', this.contextMenuListener);
  }

  ngOnDestroy(): void {
    this.treeElement.nativeElement.removeEventListener('contextmenu', this.contextMenuListener);
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
    for (const label of item.querySelectorAll('[data-slot="tree-label"]')) {
      if (label.closest('[data-slot="tree-item"]') === item) {
        return label.textContent?.trim() ?? '';
      }
    }
    return '';
  }
}
