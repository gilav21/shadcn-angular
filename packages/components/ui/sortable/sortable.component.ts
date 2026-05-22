import {
    Component,
    ChangeDetectionStrategy,
    Directive,
    input,
    model,
    output,
    signal,
    computed,
    contentChild,
    inject,
    DestroyRef,
    ElementRef,
    TemplateRef,
    viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { cn } from '../../lib/utils';
import { onPointerDrag } from '../../lib/touch';
import { createFlip, type FlipHandle } from '../../lib/flip';
import { SortableItemComponent } from './sub/sortable-item.component';
import { SortableGhostTemplateDirective } from './sub/sortable-ghost.directive';
import { SortablePlaceholderTemplateDirective } from './sub/sortable-placeholder.directive';

export { SortableItemComponent };

export type SortableOrientation = 'vertical' | 'horizontal';

export interface SortableReorderEvent {
    readonly from: number;
    readonly to: number;
}

interface SortableContext<T> {
    readonly $implicit: T;
    readonly index: number;
}

/** Marker directive placed on the <ng-template> inside ui-sortable. */
@Directive({
    selector: '[uiSortableItem]',
    standalone: true,
})
export class SortableItemTemplateDirective {
    static ngTemplateContextGuard<T>(
        _dir: SortableItemTemplateDirective,
        ctx: unknown,
    ): ctx is SortableContext<T> {
        return true;
    }
}

/** Marks the drag handle inside a row (used when handleOnly is true). */
@Directive({
    selector: '[uiSortableHandle]',
    standalone: true,
    host: {
        class: 'touch-none',
        '(mousedown)': 'onMouseDown($event)',
        '(touchstart)': 'onTouchStart($event)',
    },
})
export class SortableHandleDirective {
    private readonly parent = inject(SortableComponent, { optional: true }) as SortableComponent<unknown> | null;
    private readonly item = inject(SortableItemComponent, { optional: true });

    onMouseDown(event: MouseEvent): void {
        if (!this.parent || !this.item) return;
        event.stopPropagation();
        this.parent.startDrag(this.item.index(), event.clientX, event.clientY);
    }

    onTouchStart(event: TouchEvent): void {
        if (!this.parent || !this.item || event.touches.length === 0) return;
        event.stopPropagation();
        event.preventDefault();
        const touch = event.touches[0];
        this.parent.startDrag(this.item.index(), touch.clientX, touch.clientY);
    }
}

/** Moves an item from index `from` to index `to` in a copy of `arr`. */
function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
}

/**
 * Computes the drop gap from pointer position against item midpoints.
 * Returns a gap index in `0..rects.length` — `0` means before the first
 * item, `rects.length` means after the last.
 */
function computeTargetIndex(
    rects: DOMRect[],
    pointer: number,
    orientation: SortableOrientation,
): number {
    for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const mid = orientation === 'vertical'
            ? rect.top + rect.height / 2
            : rect.left + rect.width / 2;
        if (pointer < mid) return i;
    }
    return rects.length;
}

/** Generic drag-to-reorder list. */
@Component({
    selector: 'ui-sortable',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgTemplateOutlet],
    templateUrl: './sortable.component.html',
    host: { class: 'contents' },
})
export class SortableComponent<T> {
    readonly items = model.required<T[]>();
    readonly orientation = input<SortableOrientation>('vertical');
    readonly handleOnly = input<boolean>(false);
    readonly disabled = input<boolean>(false);
    readonly class = input('');
    readonly reorder = output<SortableReorderEvent>();

    private readonly destroyRef = inject(DestroyRef);

    private static readonly DEFAULT_ANIMATE_MS = 200;
    private readonly flip: FlipHandle;
    private flipPlayHandle: ReturnType<typeof setTimeout> | null = null;

    private readonly _dragSource = signal<number | null>(null);
    private readonly _dragTarget = signal<number | null>(null);
    private readonly _dragDelta = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    private readonly _liftedIndex = signal<number | null>(null);
    private readonly _liftOrigin = signal<number | null>(null);
    private readonly _placeholderRect = signal<DOMRect | null>(null);

    readonly dragSource = this._dragSource.asReadonly();
    readonly dragTarget = this._dragTarget.asReadonly();
    readonly dragDelta = this._dragDelta.asReadonly();
    readonly liftedIndex = this._liftedIndex.asReadonly();
    readonly placeholderRect = this._placeholderRect.asReadonly();

    private dragCleanup: (() => void) | null = null;
    private rects: DOMRect[] = [];

    readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('container');
    readonly itemTemplate = contentChild(SortableItemTemplateDirective, { read: TemplateRef<SortableContext<T>> });
    readonly ghostTemplate = contentChild(SortableGhostTemplateDirective, { read: TemplateRef<SortableContext<T>> });
    readonly placeholderTemplate = contentChild(SortablePlaceholderTemplateDirective, { read: TemplateRef<SortableContext<T>> });

    readonly classes = computed(() =>
        cn(
            'flex',
            this.orientation() === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
            this.class(),
        )
    );

    /** The item currently being dragged (or null when no drag is active). */
    readonly draggedItem = computed((): T | null => {
        const source = this._dragSource();
        if (source === null) return null;
        return this.items()[source] ?? null;
    });

    /** Template context for the ghost outlet at gap `index`. */
    ghostContext(index: number): { $implicit: T | null; index: number } {
        return { $implicit: this.draggedItem(), index };
    }

    constructor() {
        this.flip = createFlip(() => this.collectItemElements());
        this.destroyRef.onDestroy(() => {
            this.dragCleanup?.();
            this.dragCleanup = null;
            if (this.flipPlayHandle !== null) {
                clearTimeout(this.flipPlayHandle);
                this.flipPlayHandle = null;
            }
        });
    }

    private collectItemElements(): HTMLElement[] {
        const root = this.containerRef().nativeElement;
        return Array.from(root.querySelectorAll<HTMLElement>('[data-slot="sortable-item"]'));
    }

    private schedulePlay(): void {
        if (this.flipPlayHandle !== null) clearTimeout(this.flipPlayHandle);
        this.flipPlayHandle = setTimeout(() => {
            this.flipPlayHandle = null;
            void this.flip.play(SortableComponent.DEFAULT_ANIMATE_MS);
        }, 0);
    }

    private applyReorder(from: number, to: number, emit: boolean): void {
        this.flip.measure();
        const next = moveItem(this.items(), from, to);
        this.items.set(next);
        if (emit) this.reorder.emit({ from, to });
        this.schedulePlay();
    }

    shouldShowIndicatorBefore(index: number): boolean {
        const target = this._dragTarget();
        const source = this._dragSource();
        if (target === null || source === null || this.isNoOpGap(target, source)) return false;
        return index === target;
    }

    shouldShowIndicatorAfterLast(): boolean {
        const target = this._dragTarget();
        const source = this._dragSource();
        if (target === null || source === null || this.isNoOpGap(target, source)) return false;
        return target === this.items().length;
    }

    private isNoOpGap(gap: number, source: number): boolean {
        return gap === source || gap === source + 1;
    }

    startDrag(fromIndex: number, startX: number, startY: number): void {
        if (this.disabled()) return;
        this.dragCleanup?.();
        this.captureRects();
        this._dragSource.set(fromIndex);
        this._dragTarget.set(fromIndex);
        this._dragDelta.set({ x: 0, y: 0 });
        this._placeholderRect.set(this.rects[fromIndex] ?? null);

        const startPointer = this.orientation() === 'vertical' ? startY : startX;

        this.dragCleanup = onPointerDrag(
            (clientX, clientY) => this.onDragMove(fromIndex, startX, startY, clientX, clientY, startPointer),
            () => this.onDragEnd(),
        );
    }

    private captureRects(): void {
        const containerEl = this.containerRef().nativeElement;
        const itemEls = containerEl.querySelectorAll('[data-slot="sortable-item"]');
        this.rects = Array.from(itemEls).map(el => el.getBoundingClientRect());
    }

    private onDragMove(
        fromIndex: number,
        startX: number,
        startY: number,
        clientX: number,
        clientY: number,
        startPointer: number,
    ): void {
        const dx = clientX - startX;
        const dy = clientY - startY;
        this._dragDelta.set({ x: dx, y: dy });

        const pointer = this.orientation() === 'vertical' ? clientY : clientX;
        const delta = pointer - startPointer;
        const adjustedRects = this.rects.map((r, i) => {
            if (i !== fromIndex) return r;
            return this.orientation() === 'vertical'
                ? new DOMRect(r.x, r.y + delta, r.width, r.height)
                : new DOMRect(r.x + delta, r.y, r.width, r.height);
        });

        const target = computeTargetIndex(adjustedRects, pointer, this.orientation());
        this._dragTarget.set(target);
    }

    private onDragEnd(): void {
        const from = this._dragSource();
        const gap = this._dragTarget();
        this.dragCleanup = null;

        if (from === null || gap === null) {
            this.clearDragState();
            return;
        }
        const to = gap > from ? gap - 1 : gap;
        if (to === from) {
            this.clearDragState();
            return;
        }

        this.flip.measure();
        const next = moveItem(this.items(), from, to);
        this.items.set(next);
        this.clearDragState();
        this.reorder.emit({ from, to });
        this.schedulePlay();
    }

    private clearDragState(): void {
        this._dragSource.set(null);
        this._dragTarget.set(null);
        this._dragDelta.set({ x: 0, y: 0 });
        this._placeholderRect.set(null);
    }

    handleItemKeyDown(index: number, event: KeyboardEvent): void {
        if (this.disabled()) return;

        const lifted = this._liftedIndex();

        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            this.handleKeyLiftOrDrop(index, lifted);
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelKeyboardDrag();
            return;
        }

        if (lifted === null || lifted !== index) return;

        const delta = this.arrowDelta(event.key);
        if (delta === 0) return;
        event.preventDefault();

        const newIndex = Math.max(0, Math.min(this.items().length - 1, index + delta));
        if (newIndex === index) return;

        this.applyReorder(index, newIndex, true);
        this._liftedIndex.set(newIndex);
    }

    private handleKeyLiftOrDrop(index: number, lifted: number | null): void {
        if (lifted === null) {
            this._liftedIndex.set(index);
            this._liftOrigin.set(index);
        } else {
            this._liftedIndex.set(null);
            this._liftOrigin.set(null);
        }
    }

    private cancelKeyboardDrag(): void {
        const origin = this._liftOrigin();
        const lifted = this._liftedIndex();
        if (origin !== null && lifted !== null && origin !== lifted) {
            this.applyReorder(lifted, origin, false);
        }
        this._liftedIndex.set(null);
        this._liftOrigin.set(null);
    }

    private arrowDelta(key: string): number {
        const isVertical = this.orientation() === 'vertical';
        if (isVertical && key === 'ArrowDown') return 1;
        if (isVertical && key === 'ArrowUp') return -1;
        if (!isVertical && key === 'ArrowRight') return 1;
        if (!isVertical && key === 'ArrowLeft') return -1;
        return 0;
    }
}
