import { Directive, ElementRef, inject, input, output, DestroyRef } from '@angular/core';
import { onLongPress } from '../../../../lib/touch';
import { ContextMenuComponent } from '../../../context-menu';
import { NodeEditorComponent } from '../node-editor';
import type { NodeEditorContextTarget } from './node-editor-context-menu.types';
import { resolveTarget, type ContextPointer } from './node-editor-context-menu.resolve';

/**
 * How long after a long-press a `contextmenu` is assumed to be the same
 * gesture.
 *
 * Android fires `contextmenu` for a long-press as well; iOS does not. Without
 * a window the menu would open twice on one platform and not at all on the
 * other.
 */
const SAME_GESTURE_MS = 700;

/**
 * How far a finger may travel and still count as held rather than dragging.
 *
 * The same 10px `onLongPress` allows, so the two agree about what a press is —
 * they were the two halves of one disagreement when the platform's own
 * `contextmenu` used a threshold of its own.
 */
const TOUCH_SLOP_PX = 10;

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
  /** Stops the canvas from opening a context menu. */
  readonly contextMenuDisabled = input(false);

  /** Fires with the resolved target, whether or not a menu is attached. */
  readonly contextTarget = output<NodeEditorContextTarget>();

  private readonly editor = inject(NodeEditorComponent);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** When a long-press last opened the menu, to ignore the echo. */
  private lastLongPress = 0;

  /** Where the current touch gesture began, and whether it has travelled. */
  private touchStart: { x: number; y: number } | null = null;
  private touchTravelled = false;
  /** When that gesture was last heard from, so a later right-click is unaffected. */
  private lastTouchAt = 0;

  constructor() {
    const element = this.host.nativeElement;
    element.addEventListener('contextmenu', this.onContextMenu);
    element.addEventListener('touchstart', this.onTouchStart, { passive: true });
    element.addEventListener('touchmove', this.onTouchMove, { passive: true });

    /*
     * Long-press is the touch equivalent, and without it a phone could not
     * reach any of this: adding a node, adding a zone, renaming, deleting and
     * disconnecting were all behind a right-click, which a finger does not
     * have.
     */
    const stopLongPress = onLongPress(element, event => {
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (!touch) return;
      this.lastLongPress = Date.now();
      this.open({
        target: touch.target,
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
    });

    inject(DestroyRef).onDestroy(() => {
      element.removeEventListener('contextmenu', this.onContextMenu);
      element.removeEventListener('touchstart', this.onTouchStart);
      element.removeEventListener('touchmove', this.onTouchMove);
      stopLongPress();
    });
  }

  private readonly onTouchStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!touch) return;
    this.lastTouchAt = Date.now();

    /*
     * A second finger disqualifies the gesture, and must NOT reset it.
     *
     * `touchstart` fires again for every finger that joins, so starting fresh
     * here made a pinch look like a new, stationary press — the movement so
     * far forgotten, and the menu free to open again. Two fingers mean pan and
     * zoom, so the gesture is marked spent and stays that way until every
     * finger is off the glass.
     */
    if (event.touches.length > 1) {
      this.touchTravelled = true;
      this.touchStart = null;
      return;
    }

    this.touchStart = { x: touch.clientX, y: touch.clientY };
    this.touchTravelled = false;
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    this.lastTouchAt = Date.now();

    if (event.touches.length > 1) {
      this.touchTravelled = true;
      return;
    }

    const touch = event.touches[0];
    if (!touch || !this.touchStart) return;
    const distance = Math.hypot(
      touch.clientX - this.touchStart.x,
      touch.clientY - this.touchStart.y,
    );
    if (distance > TOUCH_SLOP_PX) this.touchTravelled = true;
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    // Android raises this for a long-press too; the menu is already open.
    if (Date.now() - this.lastLongPress < SAME_GESTURE_MS) {
      event.preventDefault();
      return;
    }

    /*
     * The platform's own long-press, arriving mid-pan.
     *
     * Our `onLongPress` gives up the moment the finger travels, so it is not
     * the one firing here — Android raises `contextmenu` on its own for a held
     * finger, on its own timing and its own idea of how far counts as still.
     * Drag the canvas on a phone and it panned correctly AND opened a menu.
     *
     * A right-click is deliberate and always honoured; the browser's touch
     * guess has to lose to a gesture that is visibly a pan. Bounded to the
     * gesture's own lifetime so a mouse right-click later is untouched.
     */
    if (this.touchTravelled && Date.now() - this.lastTouchAt < SAME_GESTURE_MS) {
      event.preventDefault();
      return;
    }
    if (this.open(event)) {
      /*
       * The browser's own menu is suppressed only once we have something
       * better to show. A right-click that resolves to nothing — on a
       * scrollbar inside a node's view, say — keeps the native menu, because
       * taking it away and offering nothing is worse than either.
       */
      event.preventDefault();
      event.stopPropagation();
    }
  };

  /** Resolve and show. Returns whether anything was worth showing. */
  private open(pointer: ContextPointer): boolean {
    if (this.contextMenuDisabled()) return false;

    const target = resolveTarget(pointer, this.editor);
    if (!target) return false;

    // Whatever the finger had started is not what it turned out to mean.
    this.editor.cancelGesture();

    this.contextTarget.emit(target);
    this.uiNodeEditorContextMenu().show(target.screen.x, target.screen.y, target);
    return true;
  }
}
