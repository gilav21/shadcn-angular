import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { UI_LOCALE_ID } from '../../../../lib/i18n';
import { isSecondaryTouch } from '../../../../lib/touch';
import { cn } from '../../../../lib/utils';
import type { CanvasPoint, EditorNode, NodeId } from '../..';
import { NODE_EDITOR_GROUPS_LOCALES } from './node-editor-groups.locales';
import type { NodeComment, NodeGroup } from './node-editor-groups.types';
import {
  byPaintOrder,
  groupHeader,
  membership,
  movedGroup,
  movedMembers,
  resizedGroup,
} from './node-editor-groups.utils';

/** A group and where its members should land. */
export interface GroupMoveEvent {
  readonly group: NodeGroup;
  readonly delta: CanvasPoint;
  readonly members: ReadonlyMap<NodeId, CanvasPoint>;
}

type DragMode = 'move' | 'resize';

interface DragState {
  readonly pointerId: number;
  readonly mode: DragMode;
  readonly groupId: string;
  readonly origin: CanvasPoint;
  /** The group as it was when the drag began, for a self-contained undo. */
  readonly before: NodeGroup;
  /**
   * Screen pixels per world unit, read ONCE at pointerdown.
   *
   * Everything here is rendered inside the canvas's transform, so a pointer
   * delta arrives in screen pixels and has to be divided by the zoom to be a
   * world delta. Reading it per move would be a layout read per frame; the
   * pointer is captured, so the zoom cannot change mid-drag anyway.
   */
  readonly zoom: number;
}

/** Movement, in screen pixels, before a press counts as a drag. */
const DRAG_THRESHOLD_PX = 3;

/**
 * Titled frames behind the nodes, and freestanding comments.
 *
 * ### Why this is an addon
 *
 * Neither a group nor a comment ever enters the runtime. They do not change
 * what a graph computes, what may connect to what, or the order anything runs
 * in. The moment a group meant something to evaluation, every consumer of the
 * base would have to know about groups whether they installed this or not.
 *
 * ### What it needed from the base
 *
 * A world-space slot behind the items — without it a frame that pans and zooms
 * with the plane is impossible without forking the canvas template — and
 * `pushEdit`, so a group drag and the node moves it causes land on the undo
 * stack as ONE entry. Two entries would let a single Ctrl+Z put the nodes back
 * and leave the frame behind, stranding members outside the group that owns
 * them.
 *
 * ### Membership is containment
 *
 * Recomputed from geometry, never stored. A stored list drifts the moment a
 * node is dragged out, and then a group is claiming a node that is visibly not
 * in it.
 */
@Component({
  selector: 'ui-node-editor-groups',
  exportAs: 'uiNodeEditorGroups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './node-editor-groups.component.html',
  styleUrl: './node-editor-groups.component.css',
  host: { class: 'contents' },
})
export class NodeEditorGroupsComponent {
  /** The zones drawn behind the graph. Two-way: dragging or resizing a zone writes back. */
  readonly groups = model<readonly NodeGroup[]>([]);
  /** Free-standing notes on the canvas. Two-way: editing or moving one writes back. */
  readonly comments = model<readonly NodeComment[]>([]);
  /** The editor's rendered nodes, for membership and for moving members. */
  readonly nodes = input<readonly EditorNode[]>([]);
  /** Render zones and comments without letting them be moved, resized or edited. */
  readonly readonlyGroups = input(false);
  /** Extra classes merged onto the overlay. */
  readonly class = input('');

  /**
   * A group moved, with where its members should land.
   *
   * The addon never writes node positions itself: the editor owns them and
   * routes them through the undo funnel, so this reports and the consumer
   * applies.
   */
  readonly groupMoved = output<GroupMoveEvent>();
  /** A group's title was activated — the consumer decides what to do. */
  readonly groupActivated = output<NodeGroup>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly localeId = inject(UI_LOCALE_ID);
  private drag: DragState | null = null;
  private moved = false;

  constructor() {
    /*
     * A second finger anywhere ends a frame drag.
     *
     * Listened for on the window rather than on the frame, because the second
     * finger usually lands somewhere else entirely — on the plane, on a node —
     * and this component would never hear about it. Guarding only its own
     * handlers left zones being dragged around by a pinch after nodes had
     * already been fixed, which is exactly the kind of thing that gets missed
     * once per surface.
     */
    const onSecondFinger = (event: PointerEvent): void => {
      if (this.drag && isSecondaryTouch(event)) this.abandonDrag();
    };
    globalThis.addEventListener('pointerdown', onSecondFinger, true);
    inject(DestroyRef).onDestroy(() =>
      globalThis.removeEventListener('pointerdown', onSecondFinger, true),
    );
  }

  /**
   * Give up the drag and put the frame back where it started.
   *
   * The gesture turned out to be a pinch, so the movement was never meant —
   * and members are only reported on a completed drag, so nothing else has to
   * be undone.
   */
  private abandonDrag(): void {
    const drag = this.drag;
    this.drag = null;
    this.dragging.set(null);
    this.moved = false;
    if (drag) this.write(drag.before);
  }

  protected readonly t = computed(
    () => NODE_EDITOR_GROUPS_LOCALES[this.localeId()] ?? NODE_EDITOR_GROUPS_LOCALES['en'],
  );

  /** Largest first, so a group nested inside another stays visible on top. */
  protected readonly ordered = computed(() => byPaintOrder(this.groups()));

  private readonly members = computed(() => membership(this.groups(), this.nodes()));

  protected readonly headerHeight = groupHeader();
  protected readonly dragging = signal<string | null>(null);

  protected memberCount(group: NodeGroup): number {
    return this.members().get(group.id)?.length ?? 0;
  }

  protected label(group: NodeGroup): string {
    return this.t()
      .groupLabel.replace('{title}', group.title)
      .replace('{count}', String(this.memberCount(group)));
  }

  protected frameClasses(group: NodeGroup): string {
    return cn(
      'absolute rounded-lg border-2 border-dashed',
      this.dragging() === group.id ? 'opacity-80' : '',
      this.class(),
    );
  }

  protected onPointerDown(event: PointerEvent, group: NodeGroup, mode: DragMode): void {
    if (isSecondaryTouch(event)) {
      this.abandonDrag();
      return;
    }
    if (this.readonlyGroups() || event.button !== 0) return;

    const zoom = this.zoomFrom(event.target as HTMLElement, group);
    this.drag = {
      pointerId: event.pointerId,
      mode,
      groupId: group.id,
      origin: { x: event.clientX, y: event.clientY },
      before: group,
      zoom,
    };
    this.moved = false;
    this.dragging.set(group.id);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    // Two guards, not one `||`: the combined form reads as an optional chain
    // to Sonar, and the optional-chain rewrite stops narrowing `drag` to
    // non-null for everything below it.
    if (drag === null) return;
    if (drag.pointerId !== event.pointerId) return;

    const delta = this.worldDelta(event, drag);
    if (!this.moved && Math.hypot(delta.x * drag.zoom, delta.y * drag.zoom) < DRAG_THRESHOLD_PX) {
      return;
    }
    this.moved = true;

    const current = this.groupById(drag.groupId);
    if (!current) return;

    const next =
      drag.mode === 'move' ? movedGroup(drag.before, delta) : resizedGroup(drag.before, delta);
    this.write(next);
    event.stopPropagation();
  }

  protected onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    // Two guards, not one `||`: the combined form reads as an optional chain
    // to Sonar, and the optional-chain rewrite stops narrowing `drag` to
    // non-null for everything below it.
    if (drag === null) return;
    if (drag.pointerId !== event.pointerId) return;

    this.drag = null;
    this.dragging.set(null);

    const after = this.groupById(drag.groupId);
    if (!after) return;

    if (!this.moved) {
      this.groupActivated.emit(after);
      return;
    }

    if (drag.mode !== 'move') return;
    /*
     * Members move from the position they held BEFORE the drag, using the
     * frame's starting rect — the frame has already moved, so asking which
     * nodes it contains now would collect whatever it happens to be over.
     */
    const delta = { x: after.x - drag.before.x, y: after.y - drag.before.y };
    this.groupMoved.emit({
      group: after,
      delta,
      members: movedMembers(drag.before, this.nodes(), delta),
    });
  }

  /**
   * Undo support for the frame itself.
   *
   * Handed to the consumer's `pushEdit` so the frame and its members are one
   * entry. The addon supplies both directions because only it knows how to put
   * its own data back.
   */
  restoreGroup(group: NodeGroup): void {
    this.write(group);
  }

  private write(group: NodeGroup): void {
    this.groups.update(existing => existing.map(g => (g.id === group.id ? group : g)));
  }

  private groupById(id: string): NodeGroup | null {
    return this.groups().find(g => g.id === id) ?? null;
  }

  private worldDelta(event: PointerEvent, drag: DragState): CanvasPoint {
    return {
      x: (event.clientX - drag.origin.x) / drag.zoom,
      y: (event.clientY - drag.origin.y) / drag.zoom,
    };
  }

  /**
   * Screen pixels per world unit, derived from what is on screen.
   *
   * Measured rather than taken as an input: the frame is already rendered at a
   * known world width, so its drawn width divided by that IS the zoom. One
   * layout read at pointerdown, and nothing to keep in sync.
   */
  private zoomFrom(target: HTMLElement, group: NodeGroup): number {
    const frame = target.closest('[data-slot="node-editor-group"]') ?? this.host.nativeElement;
    const width = frame.getBoundingClientRect().width;
    return width > 0 && group.width > 0 ? width / group.width : 1;
  }
}
