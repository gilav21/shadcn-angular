import {
  Directive,
  HostListener,
  input,
  output,
} from '@angular/core';
import { ContextMenuComponent } from './context-menu';

export interface ContextMenuEvent<T> {
  event: MouseEvent;
  item: T;
  index?: number;
}

/**
 * Attach a context menu to any element with data. Right-clicking the host
 * element opens the provided {@link ContextMenuComponent} at the cursor position
 * and emits {@link ContextMenuEvent} with the bound data.
 */
@Directive({
  selector: '[uiContextMenuAttach]',
  standalone: true,
})
export class ContextMenuAttachDirective<T> {
  uiContextMenuAttach = input.required<ContextMenuComponent>();
  contextMenuData = input.required<T>();
  disabled = input<boolean>(false);

  contextMenuTriggered = output<ContextMenuEvent<T>>();

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: MouseEvent): void {
    if (this.disabled()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const contextMenu = this.uiContextMenuAttach();
    if (!contextMenu) return;

    this.contextMenuTriggered.emit({
      event,
      item: this.contextMenuData(),
    });

    contextMenu.show(event.clientX, event.clientY);
  }
}
