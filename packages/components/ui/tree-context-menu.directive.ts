import {
  Directive,
  ElementRef,
  inject,
  input,
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
 * emits {@link TreeContextMenuEvent} with the node data extracted from the DOM.
 */
@Directive({
  selector: 'ui-tree[uiTreeContextMenu]',
  standalone: true,
})
export class TreeContextMenuDirective<T = unknown> {
  uiTreeContextMenu = input.required<ContextMenuComponent>();
  contextMenuDisabled = input<boolean>(false);

  nodeContextMenu = output<TreeContextMenuEvent<T>>();

  private readonly treeElement = inject(ElementRef<HTMLElement>);
  private readonly contextMenuListener = (event: MouseEvent) => {
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

  ngOnDestroy() {
    this.treeElement.nativeElement.removeEventListener('contextmenu', this.contextMenuListener);
  }

  private extractNodeData(element: HTMLElement): T {
    const key = element.dataset['key'];
    const expanded = element.dataset['expanded'] === 'true';
    const selected = element.dataset['selected'] === 'true';

    const labelElement = element.querySelector('[data-slot="tree-label"]');
    const label = labelElement?.textContent?.trim() || '';

    return {
      key,
      label,
      expanded,
      selected,
      element,
    } as unknown as T;
  }
}
