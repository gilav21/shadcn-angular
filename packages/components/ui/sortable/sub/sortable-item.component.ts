import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SortableComponent } from '../sortable.component';

function prefersReducedMotion(): boolean {
    return globalThis.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Wraps one rendered row inside ui-sortable. */
@Component({
    selector: 'ui-sortable-item',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './sortable-item.component.html',
    host: { class: 'contents' },
})
export class SortableItemComponent {
    /**
     * Position of this row in the parent's `items()` — bind it to the
     * `index` of the `uiSortableItem` template context. It is the row's
     * identity for every interaction (drag source, drop target, keyboard
     * moves) and is mirrored to `data-index`, so a stale value silently
     * reorders the wrong item.
     */
    readonly index = input.required<number>();
    /** Extra classes merged onto the row wrapper, after the drag/lift/position classes so they can override them. */
    readonly class = input('');

    private readonly parent = inject(SortableComponent, { optional: true }) as SortableComponent<unknown> | null;

    readonly disabled = computed(() => this.parent?.disabled() ?? false);

    readonly classes = computed(() => {
        const idx = this.index();
        const isSource = this.parent?.dragSource() === idx;
        const isLifted = this.parent?.liftedIndex() === idx;
        const bodyDraggable = !(this.parent?.handleOnly() ?? false) && !this.disabled();
        return cn(
            'relative flex items-center gap-2 select-none outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded',
            bodyDraggable ? 'touch-none cursor-grab active:cursor-grabbing' : '',
            isSource ? 'z-50 shadow-2xl' : '',
            isLifted ? 'ring-2 ring-primary ring-offset-1 rounded' : '',
            this.positionClassValue(),
            this.class(),
        );
    });

    readonly positionClassValue = computed(() => {
        const fn = this.parent?.positionClass();
        if (!fn || !this.parent) return '';
        const items = this.parent.items();
        const idx = this.index();
        const item = items[idx];
        if (item === undefined) return '';
        return fn(item, idx, items.length, this.parent.resolvedListId());
    });

    readonly dragStyle = computed((): Record<string, string> => {
        const idx = this.index();
        if (this.parent?.dragSource() !== idx) return {};
        const delta = this.parent?.effectiveDragDelta() ?? { x: 0, y: 0 };
        const lift = prefersReducedMotion() ? '' : ' scale(1.02) rotate(1.5deg)';
        return {
            transform: `translate(${delta.x}px, ${delta.y}px)${lift}`,
            position: 'relative',
            'z-index': '50',
        };
    });

    /**
     * Host `mousedown` handler — starts dragging the whole row from where the
     * pointer pressed. Deliberately inert when the parent sets `handleOnly`,
     * in which case only {@link SortableHandleDirective} may start a drag.
     */
    onMouseDown(event: MouseEvent): void {
        if (!this.parent || this.parent.handleOnly()) return;
        this.parent.startDrag(this.index(), event.clientX, event.clientY);
    }

    /**
     * Host `touchstart` counterpart to {@link onMouseDown} — row dragging works
     * on touch-only devices with no long-press required. Calls
     * `preventDefault()` (with the row's `touch-none` class) so the gesture
     * drags instead of scrolling; only the first touch point is tracked.
     */
    onTouchStart(event: TouchEvent): void {
        if (!this.parent || this.parent.handleOnly() || event.touches.length === 0) return;
        event.preventDefault();
        const touch = event.touches[0];
        this.parent.startDrag(this.index(), touch.clientX, touch.clientY);
    }

    /**
     * Host `keydown` handler — forwards the row's {@link index} and the event
     * to the parent's `handleItemKeyDown`, which owns the Space/Enter lift,
     * Arrow/Home/End moves, Tab hand-off and Escape cancel. Keyboard
     * reordering ignores `handleOnly`, since the row itself is the focus
     * target (`tabindex="0"` unless disabled).
     */
    onKeyDown(event: KeyboardEvent): void {
        this.parent?.handleItemKeyDown(this.index(), event);
    }
}
