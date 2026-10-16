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

export interface ContextMenuEvent<T> {
  /** The `contextmenu` event of a right-click or the keyboard key, or the `touchstart` that began a long-press. */
  event: MouseEvent | TouchEvent;
  item: T;
  index?: number;
}

/**
 * Attach a context menu to any element with data. Right-clicking, pressing the
 * context-menu key on, or long-pressing the host element opens the provided
 * {@link ContextMenuComponent} at the pointer or finger and emits
 * {@link ContextMenuEvent} with the bound data.
 */
@Directive({
  selector: '[uiContextMenuAttach]',
  standalone: true,
})
export class ContextMenuAttachDirective<T> {
  /** The menu to open when the host is right-clicked or long-pressed. */
  uiContextMenuAttach = input.required<ContextMenuComponent>();
  /** Value handed back with the event, so a handler knows what was clicked. */
  contextMenuData = input.required<T>();
  /** Stops the host from opening the menu. */
  disabled = input<boolean>(false);

  /** Emits the bound data and the originating event when the menu opens. */
  contextMenuTriggered = output<ContextMenuEvent<T>>();

  constructor() {
    const stop = onContextGesture(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement, (gesture) => this.open(gesture));
    inject(DestroyRef).onDestroy(stop);
  }

  /** Whether the gesture was taken: a disabled host leaves it to the browser. */
  private open(gesture: ContextGesture): boolean {
    if (this.disabled()) return false;

    const contextMenu = this.uiContextMenuAttach();
    if (!contextMenu) return true;

    this.contextMenuTriggered.emit({ event: gesture.source, item: this.contextMenuData() });
    contextMenu.show(gesture.clientX, gesture.clientY);
    return true;
  }
}
