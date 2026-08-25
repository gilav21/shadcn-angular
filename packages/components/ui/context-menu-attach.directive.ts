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
  /** The menu to open when the host is right-clicked. */
  uiContextMenuAttach = input.required<ContextMenuComponent>();
  /** Value handed back with the event, so a handler knows what was clicked. */
  contextMenuData = input.required<T>();
  /** Stops the host from opening the menu. */
  disabled = input<boolean>(false);

  /** Emits the bound data and the originating event when the menu opens. */
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
