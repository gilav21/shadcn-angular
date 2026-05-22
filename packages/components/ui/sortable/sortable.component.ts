import {
    Component,
    ChangeDetectionStrategy,
    Directive,
    effect,
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
import {
    peersInGroup,
    registerSortable,
    type AcceptResult,
    type ForeignDropContext,
    type SortableRegistryEntry,
} from '../../lib/sortable-registry';
import { SortableItemComponent } from './sub/sortable-item.component';
import { SortableGhostTemplateDirective } from './sub/sortable-ghost.directive';
import { SortablePlaceholderTemplateDirective } from './sub/sortable-placeholder.directive';
import type {
    SortableAccepts,
    SortableContext,
    SortableDropRejectedEvent,
    SortableLandEffectFn,
    SortableLocation,
    SortableOrientation,
    SortablePositionClassFn,
    SortableReorderEvent,
    SortableTrackByFn,
} from './sortable.types';

export { SortableItemComponent };
export type {
    SortableAccepts,
    SortableContext,
    SortableDropRejectedEvent,
    SortableLandEffectFn,
    SortableLocation,
    SortableOrientation,
    SortablePositionClassFn,
    SortableReorderEvent,
    SortableTrackByFn,
};

/**
 * Pre-made land-effect class names that consumers can plug into the
 * `[landEffect]` input (added in T4.2). Each value is a CSS class
 * defined in `sortable-item.component.css` with a matching one-shot
 * `@keyframes` animation that respects `prefers-reduced-motion`.
 *
 * Consumers may use these names directly OR pass their own class.
 *
 * @example
 *   // In your component:
 *   protected readonly flash = (): string => SORTABLE_LAND_EFFECTS.flash;
 *
 *   <ui-sortable [(items)]="rows" [landEffect]="flash">
 */
export const SORTABLE_LAND_EFFECTS = {
    flash: 'ui-sortable-land-flash',
    pulse: 'ui-sortable-land-pulse',
    shake: 'ui-sortable-land-shake',
    glow:  'ui-sortable-land-glow',
} as const;

/**
 * Name of a built-in land effect, or any custom CSS class string.
 * The `string & {}` intersection keeps the literal-union autocomplete
 * intact while still accepting arbitrary strings.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type SortableLandEffect =
    | (typeof SORTABLE_LAND_EFFECTS)[keyof typeof SORTABLE_LAND_EFFECTS]
    | (string & {});

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
    readonly listId = input<string>('');
    readonly group = input<string>('');
    readonly accepts = input<SortableAccepts<T>>(true);
    readonly positionClass = input<SortablePositionClassFn<T>>(() => '');
    readonly landEffect = input<SortableLandEffectFn<T>>(() => null);
    readonly trackBy = input<SortableTrackByFn<T>>((item) => item);
    readonly reorder = output<SortableReorderEvent<T>>();
    readonly dropRejected = output<SortableDropRejectedEvent<T>>();

    private static sortableIdCounter = 0;
    private readonly autoListId = `sortable-${++SortableComponent.sortableIdCounter}`;
    /** The list's resolved id — the `listId` input, or an auto-generated value when blank. */
    readonly resolvedListId = computed((): string => this.listId() || this.autoListId);

    private readonly destroyRef = inject(DestroyRef);

    private static readonly DEFAULT_ANIMATE_MS = 200;
    private readonly flip: FlipHandle;
    private flipPlayHandle: ReturnType<typeof setTimeout> | null = null;
    private readonly registryEntry: SortableRegistryEntry;
    private registryUnsub: (() => void) | null = null;

    private readonly _dragSource = signal<number | null>(null);
    private readonly _dragTarget = signal<number | null>(null);
    private readonly _dragDelta = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    private readonly _liftedIndex = signal<number | null>(null);
    private readonly _liftOrigin = signal<number | null>(null);
    private readonly _placeholderRect = signal<DOMRect | null>(null);
    private readonly _hoverPeer = signal<SortableRegistryEntry | null>(null);
    private readonly _hoverPeerTarget = signal<number | null>(null);
    private readonly _rejectReason = signal<string | null>(null);

    readonly dragSource = this._dragSource.asReadonly();
    readonly dragTarget = this._dragTarget.asReadonly();
    readonly dragDelta = this._dragDelta.asReadonly();
    readonly liftedIndex = this._liftedIndex.asReadonly();
    readonly placeholderRect = this._placeholderRect.asReadonly();
    readonly hoverPeer = this._hoverPeer.asReadonly();
    readonly hoverPeerTarget = this._hoverPeerTarget.asReadonly();
    readonly rejectReason = this._rejectReason.asReadonly();

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
        this.registryEntry = this.buildRegistryEntry();

        effect(() => {
            const g = this.group();
            if (this.registryUnsub) {
                this.registryUnsub();
                this.registryUnsub = null;
            }
            if (g !== '') {
                this.registryUnsub = registerSortable(this.registryEntry);
            }
        });

        this.destroyRef.onDestroy(() => {
            this.dragCleanup?.();
            this.dragCleanup = null;
            if (this.flipPlayHandle !== null) {
                clearTimeout(this.flipPlayHandle);
                this.flipPlayHandle = null;
            }
            this.registryUnsub?.();
            this.registryUnsub = null;
        });
    }

    private collectItemElements(): HTMLElement[] {
        const root = this.containerRef().nativeElement;
        return Array.from(root.querySelectorAll<HTMLElement>('[data-slot="sortable-item"]'));
    }

    private getCurrentItemRects(): DOMRect[] {
        return this.collectItemElements().map(el => el.getBoundingClientRect());
    }

    /** Stable proxy that adapts this component to the `SortableRegistryEntry` contract. */
    private buildRegistryEntry(): SortableRegistryEntry {
        const self = this;
        return {
            get listId(): string { return self.resolvedListId(); },
            get group(): string { return self.group(); },
            get element(): HTMLElement { return self.containerRef().nativeElement; },
            get orientation(): SortableOrientation { return self.orientation(); },
            getItemRects: (): DOMRect[] => self.getCurrentItemRects(),
            canAccept: (item: unknown, ctx: ForeignDropContext): AcceptResult => self.evaluateAccepts(item as T, ctx),
            onForeignEnter: (_item: unknown, _fromListId: string): void => undefined,
            onForeignLeave: (): void => undefined,
            receiveItem: (_item: unknown, _atIndex: number): void => undefined,
            removeItem: (_item: unknown): void => undefined,
        };
    }

    private schedulePlay(): void {
        if (this.flipPlayHandle !== null) clearTimeout(this.flipPlayHandle);
        this.flipPlayHandle = setTimeout(() => {
            this.flipPlayHandle = null;
            void this.flip.play(SortableComponent.DEFAULT_ANIMATE_MS);
        }, 0);
    }

    private applyReorder(
        from: number,
        to: number,
        options: { readonly clearDrag: boolean; readonly emit: boolean },
    ): void {
        if (from === to) {
            if (options.clearDrag) this.clearDragState();
            return;
        }
        this.flip.measure();
        const item = this.items()[from];
        const next = moveItem(this.items(), from, to);
        this.items.set(next);
        if (options.clearDrag) this.clearDragState();
        if (options.emit) this.emitReorder(from, to, item);
        this.schedulePlay();
        if (options.emit) this.scheduleLandEffect(from, to, item);
    }

    /** Evaluate the accepts predicate for a foreign item drop. Disabled lists always reject. */
    evaluateAccepts(item: T, ctx: ForeignDropContext): AcceptResult {
        if (this.disabled()) return { ok: false, reason: 'disabled' };
        const acceptsInput = this.accepts();
        if (typeof acceptsInput === 'boolean') return acceptsInput;
        const ctxFull = { ...ctx, toListId: this.resolvedListId() };
        return acceptsInput(item, ctxFull);
    }

    private emitReorder(fromIndex: number, toIndex: number, item: T): void {
        const lid = this.resolvedListId();
        this.reorder.emit({
            from: { listId: lid, index: fromIndex },
            to: { listId: lid, index: toIndex },
            item,
        });
    }

    trackByItem = (index: number, item: T): unknown => this.trackBy()(item, index);

    /** Schedule the land-effect class on the just-landed item at `toIndex`. */
    private scheduleLandEffect(fromIndex: number, toIndex: number, item: T): void {
        const lid = this.resolvedListId();
        const cls = this.landEffect()(
            item,
            { listId: lid, index: fromIndex },
            { listId: lid, index: toIndex },
        );
        if (cls === null || cls === '') return;
        setTimeout(() => {
            const el = this.collectItemElements()[toIndex];
            if (!el) return;
            el.classList.add(cls);
            setTimeout(() => el.classList.remove(cls), SortableComponent.DEFAULT_ANIMATE_MS);
        }, 0);
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
        this._dragDelta.set({ x: clientX - startX, y: clientY - startY });

        const peer = this.findHoverPeer(clientX, clientY);
        if (peer === null) {
            this.updateLocalTarget(fromIndex, clientX, clientY, startPointer);
        } else {
            this.updatePeerTarget(peer, clientX, clientY);
        }
    }

    private findHoverPeer(clientX: number, clientY: number): SortableRegistryEntry | null {
        const groupName = this.group();
        if (groupName === '') return null;
        for (const peer of peersInGroup(groupName, this.registryEntry)) {
            const r = peer.element.getBoundingClientRect();
            if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
                return peer;
            }
        }
        return null;
    }

    private updateLocalTarget(
        fromIndex: number,
        clientX: number,
        clientY: number,
        startPointer: number,
    ): void {
        this._hoverPeer.set(null);
        this._hoverPeerTarget.set(null);
        const isVertical = this.orientation() === 'vertical';
        const pointer = isVertical ? clientY : clientX;
        const delta = pointer - startPointer;
        const adjustedRects = this.rects.map((r, i) => {
            if (i !== fromIndex) return r;
            return isVertical
                ? new DOMRect(r.x, r.y + delta, r.width, r.height)
                : new DOMRect(r.x + delta, r.y, r.width, r.height);
        });
        this._dragTarget.set(computeTargetIndex(adjustedRects, pointer, this.orientation()));
    }

    private updatePeerTarget(peer: SortableRegistryEntry, clientX: number, clientY: number): void {
        this._hoverPeer.set(peer);
        const pointer = peer.orientation === 'vertical' ? clientY : clientX;
        this._hoverPeerTarget.set(computeTargetIndex(peer.getItemRects(), pointer, peer.orientation));
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
        this.applyReorder(from, to, { clearDrag: true, emit: true });
    }

    private clearDragState(): void {
        this._dragSource.set(null);
        this._dragTarget.set(null);
        this._dragDelta.set({ x: 0, y: 0 });
        this._placeholderRect.set(null);
        this._hoverPeer.set(null);
        this._hoverPeerTarget.set(null);
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

        this.applyReorder(index, newIndex, { clearDrag: false, emit: true });
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
            this.applyReorder(lifted, origin, { clearDrag: false, emit: false });
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
