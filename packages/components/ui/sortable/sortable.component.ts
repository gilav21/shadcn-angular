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
import { startAutoScroll, type AutoScrollController } from '../../lib/auto-scroll';
import { acquireAriaLive, type AriaLiveHandle } from '../../lib/sortable-aria-live';
import { SORTABLE_LOCALES, type SortableLocale } from './sortable-locales';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
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
    SortableForeignHoverEvent,
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
    SortableForeignHoverEvent,
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
    sourceIndex: number,
): number {
    for (let i = 0; i < rects.length; i++) {
        if (i === sourceIndex) continue;
        const rect = rects[i];
        const mid = orientation === 'vertical'
            ? rect.top + rect.height / 2
            : rect.left + rect.width / 2;
        if (pointer < mid) return i;
    }
    return rects.length;
}

interface BuiltInLandEffect {
    readonly keyframes: Keyframe[];
    readonly duration: number;
    readonly easing: string;
}

/**
 * Built-in land effects play via the Web Animations API with
 * `composite: 'add'` so transform-based effects (pulse, shake) overlay
 * the FLIP "zip" translate instead of being suppressed by it.
 * `flash` / `glow` use `color-mix` so they work with any `--primary`
 * format (the theme uses `oklch(...)`, which is incompatible with the
 * legacy `hsl(var(--primary) / α)` syntax).
 */
const BUILT_IN_LAND_EFFECTS: Record<string, BuiltInLandEffect> = {
    'ui-sortable-land-flash': {
        // Tinted inset shadow layered OVER the item's existing background so
        // the flash is visible regardless of the item's own bg color. Using
        // backgroundColor for the flash didn't work — `composite: 'add'`
        // doesn't apply additively to colors, and replacing the bg briefly
        // erased the visible card colour rather than tinting it.
        keyframes: [
            { boxShadow: 'inset 0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent)' },
            { boxShadow: 'inset 0 0 0 100px color-mix(in srgb, var(--primary) 45%, transparent)', offset: 0.3 },
            { boxShadow: 'inset 0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent)' },
        ],
        duration: 550,
        easing: 'ease-out',
    },
    'ui-sortable-land-pulse': {
        keyframes: [
            { transform: 'scale(1)' },
            { transform: 'scale(1.06)', offset: 0.5 },
            { transform: 'scale(1)' },
        ],
        duration: 400,
        easing: 'ease-out',
    },
    'ui-sortable-land-shake': {
        keyframes: [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-4px)', offset: 0.2 },
            { transform: 'translateX(4px)',  offset: 0.4 },
            { transform: 'translateX(-3px)', offset: 0.6 },
            { transform: 'translateX(3px)',  offset: 0.8 },
            { transform: 'translateX(0)' },
        ],
        duration: 450,
        easing: 'ease-out',
    },
    'ui-sortable-land-glow': {
        keyframes: [
            { boxShadow: '0 0 0 0 color-mix(in srgb, var(--primary) 60%, transparent)' },
            { boxShadow: '0 0 0 10px color-mix(in srgb, var(--primary) 0%, transparent)' },
        ],
        duration: 650,
        easing: 'ease-out',
    },
};

function playBuiltInLandEffect(el: HTMLElement, effect: BuiltInLandEffect): void {
    const reduce = globalThis.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) return;
    el.animate(effect.keyframes, {
        duration: effect.duration,
        easing: effect.easing,
        composite: 'add',
        fill: 'none',
    });
}

/** Generic drag-to-reorder list. */
@Component({
    selector: 'ui-sortable',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgTemplateOutlet],
    templateUrl: './sortable.component.html',
    styles: [`
        @keyframes ui-sortable-ghost-fade-in {
            from { transform: scaleY(0.4); opacity: 0; }
            to   { transform: scaleY(1);   opacity: 1; }
        }
        .ui-sortable-ghost-fade {
            animation: ui-sortable-ghost-fade-in 110ms ease-out;
            transform-origin: top;
        }
        @media (prefers-reduced-motion: reduce) {
            .ui-sortable-ghost-fade { animation: none; }
        }
    `],
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
    readonly autoScroll = input<boolean>(true);
    readonly accepts = input<SortableAccepts<T>>(true);
    readonly locale = input<LocaleInput<SortableLocale>>();
    readonly ariaLabel = input<string>('list');
    readonly ariaItemLabel = input<(item: T, index: number) => string>((_, i) => `item ${i + 1}`);
    readonly positionClass = input<SortablePositionClassFn<T>>(() => '');
    readonly landEffect = input<SortableLandEffectFn<T>>(() => null);
    readonly trackBy = input<SortableTrackByFn<T>>((item) => item);
    readonly reorder = output<SortableReorderEvent<T>>();
    readonly dropRejected = output<SortableDropRejectedEvent<T>>();
    readonly itemEnter = output<SortableForeignHoverEvent<T>>();
    readonly itemLeave = output<SortableForeignHoverEvent<T>>();

    private static sortableIdCounter = 0;
    private readonly autoListId = `sortable-${++SortableComponent.sortableIdCounter}`;
    /** The list's resolved id — the `listId` input, or an auto-generated value when blank. */
    readonly resolvedListId = computed((): string => this.listId() || this.autoListId);
    private readonly i18n = createLocaleBindings(this.locale, SORTABLE_LOCALES);
    /** The active locale strings (resolves the `locale()` input with global / English fallback). */
    readonly currentLocale = this.i18n.t;
    /** `'rtl'` when the active locale is RTL, otherwise `null` — bind to `[attr.dir]`. */
    protected readonly dir = this.i18n.dir;

    private itemLabel(index: number): string {
        const item = this.items()[index];
        if (item === undefined) return `item ${index + 1}`;
        return this.ariaItemLabel()(item, index);
    }

    private readonly destroyRef = inject(DestroyRef);

    private static readonly DEFAULT_ANIMATE_MS = 200;
    /** Removal delay for land-effect classes — must cover the longest built-in keyframe (~600ms). */
    private static readonly LAND_EFFECT_MS = 700;
    private readonly flip: FlipHandle;
    private flipPlayHandle: ReturnType<typeof setTimeout> | null = null;
    private readonly registryEntry: SortableRegistryEntry;
    private registryUnsub: (() => void) | null = null;
    private autoScroller: AutoScrollController | null = null;
    private dragStartLength: number | null = null;
    private readonly ariaLive: AriaLiveHandle = acquireAriaLive();

    private readonly _dragSource = signal<number | null>(null);
    private readonly _dragTarget = signal<number | null>(null);
    private readonly _dragDelta = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    private readonly _liftedIndex = signal<number | null>(null);
    private readonly _liftOrigin = signal<number | null>(null);
    private readonly _placeholderRect = signal<DOMRect | null>(null);
    private readonly _hoverPeer = signal<SortableRegistryEntry | null>(null);
    private readonly _hoverPeerTarget = signal<number | null>(null);
    private readonly _rejectReason = signal<string | null>(null);
    private readonly _foreignHover = signal<{ readonly item: T; readonly fromListId: string } | null>(null);

    readonly dragSource = this._dragSource.asReadonly();
    readonly dragTarget = this._dragTarget.asReadonly();
    readonly dragDelta = this._dragDelta.asReadonly();
    readonly liftedIndex = this._liftedIndex.asReadonly();
    readonly placeholderRect = this._placeholderRect.asReadonly();
    readonly hoverPeer = this._hoverPeer.asReadonly();
    readonly hoverPeerTarget = this._hoverPeerTarget.asReadonly();
    readonly rejectReason = this._rejectReason.asReadonly();
    readonly foreignHover = this._foreignHover.asReadonly();

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

    /**
     * Cursor delta adjusted to compensate for ghost-driven flow shifts.
     *
     * When the projected drop target sits BEFORE the source's flow slot,
     * inserting the ghost in flow pushes the source's flow slot forward
     * by the ghost's height (vertical) or width (horizontal). The source
     * still has a CSS `transform: translate(...)` driven by raw cursor
     * delta — without this compensation, the rendered source visually
     * jumps away from the cursor by the shift amount.
     *
     * Subtracting the source's height/width from the relevant axis of
     * the delta cancels out the flow shift so the dragged element stays
     * glued to the cursor regardless of ghost position.
     */
    readonly effectiveDragDelta = computed((): { x: number; y: number } => {
        const delta = this._dragDelta();
        const source = this._dragSource();
        const target = this._dragTarget();
        const placeholder = this._placeholderRect();
        if (source === null || target === null || placeholder === null) return delta;
        const noOp = target === source || target === source + 1;
        if (noOp || target >= source) return delta;
        return this.orientation() === 'vertical'
            ? { x: delta.x, y: delta.y - placeholder.height }
            : { x: delta.x - placeholder.width, y: delta.y };
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

        effect(() => {
            if (this._dragSource() === null) return;
            if (this.disabled()) {
                this.cancelDragDueTo('disabled');
                return;
            }
            const startLen = this.dragStartLength;
            if (startLen !== null && this.items().length !== startLen) {
                this.cancelDragDueTo('list-changed');
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
            this.ariaLive.release();
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
            onForeignEnter: (item: unknown, fromListId: string): void => self.handleForeignEnter(item as T, fromListId),
            onForeignLeave: (): void => self.handleForeignLeave(),
            setRejectReason: (reason: string | null): void => self._rejectReason.set(reason),
            receiveItem: (item: unknown, atIndex: number): void => self.handleReceiveItem(item as T, atIndex),
            removeItem: (item: unknown): void => self.handleRemoveItem(item as T),
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
            if (options.clearDrag) {
                // No-op pointer drop: animate the source back to its origin
                // slot via FLIP so it matches the "zip" feel of a real reorder.
                this.flip.measure();
                this.clearDragState();
                this.schedulePlay();
            }
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

    /** Receiver-side handler invoked when a foreign item starts hovering this list. */
    private handleForeignEnter(item: T, fromListId: string): void {
        this._foreignHover.set({ item, fromListId });
        this.itemEnter.emit({ item, fromListId });
    }

    /** Receiver-side handler invoked when the hovering foreign item leaves this list. */
    private handleForeignLeave(): void {
        const current = this._foreignHover();
        this._foreignHover.set(null);
        this._rejectReason.set(null);
        if (current !== null) {
            this.itemLeave.emit(current);
        }
    }

    /** Receiver-side handler: insert a foreign item at `atIndex` (caller validated canAccept). */
    private handleReceiveItem(item: T, atIndex: number): void {
        this.flip.measure();
        const next = [...this.items()];
        next.splice(atIndex, 0, item);
        this.items.set(next);
        this.schedulePlay();
    }

    /** Source-side handler: remove `item` from this list by reference. */
    private handleRemoveItem(item: T): void {
        const idx = this.items().indexOf(item);
        if (idx === -1) return;
        this.flip.measure();
        const next = [...this.items()];
        next.splice(idx, 1);
        this.items.set(next);
        this.schedulePlay();
    }

    /** Normalize an AcceptResult to a uniform `{ ok, reason }` shape. */
    private normalizeAccept(result: AcceptResult): { ok: boolean; reason: string | null } {
        if (typeof result === 'boolean') return { ok: result, reason: null };
        return { ok: result.ok, reason: result.reason ?? null };
    }

    /** Cancel an in-flight drag because the parent disabled the list or mutated items() under us. */
    private cancelDragDueTo(reason: string): void {
        const src = this._dragSource();
        if (src === null) return;
        const item = this.items()[src] ?? null;
        this.dragCleanup?.();
        this.dragCleanup = null;
        const peer = this._hoverPeer();
        if (peer !== null) peer.onForeignLeave();
        this.clearDragState();
        if (item !== null) {
            this.dropRejected.emit({
                item,
                fromListId: this.resolvedListId(),
                toListId: peer?.listId ?? this.resolvedListId(),
                toIndex: this._hoverPeerTarget() ?? -1,
                reason,
            });
        }
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
            const builtIn = BUILT_IN_LAND_EFFECTS[cls];
            if (builtIn !== undefined) {
                playBuiltInLandEffect(el, builtIn);
            } else {
                el.classList.add(cls);
                setTimeout(() => el.classList.remove(cls), SortableComponent.LAND_EFFECT_MS);
            }
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
        this.dragStartLength = this.items().length;
        if (this.autoScroll()) {
            this.autoScroller = startAutoScroll();
        }

        this.dragCleanup = onPointerDrag(
            (clientX, clientY) => this.onDragMove(fromIndex, startX, startY, clientX, clientY),
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
    ): void {
        this._dragDelta.set({ x: clientX - startX, y: clientY - startY });
        this.autoScroller?.update(clientX, clientY);

        const peer = this.findHoverPeer(clientX, clientY);
        if (peer === null) {
            this.updateLocalTarget(fromIndex, clientX, clientY);
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
    ): void {
        const previousPeer = this._hoverPeer();
        if (previousPeer !== null) {
            previousPeer.onForeignLeave();
        }
        this._hoverPeer.set(null);
        this._hoverPeerTarget.set(null);
        const isVertical = this.orientation() === 'vertical';
        const pointer = isVertical ? clientY : clientX;
        this._dragTarget.set(computeTargetIndex(this.rects, pointer, this.orientation(), fromIndex));
    }

    private updatePeerTarget(peer: SortableRegistryEntry, clientX: number, clientY: number): void {
        const previousPeer = this._hoverPeer();
        if (previousPeer !== null && previousPeer !== peer) {
            previousPeer.onForeignLeave();
        }
        if (previousPeer !== peer) {
            const item = this.draggedItem();
            if (item !== null) {
                peer.onForeignEnter(item, this.resolvedListId());
            }
        }
        this._hoverPeer.set(peer);
        const pointer = peer.orientation === 'vertical' ? clientY : clientX;
        const target = computeTargetIndex(peer.getItemRects(), pointer, peer.orientation, -1);
        this._hoverPeerTarget.set(target);
        this.updatePeerRejectVisual(peer, target);
    }

    /** Push the receiving peer's `data-reject` attribute based on a live evaluation of accepts. */
    private updatePeerRejectVisual(peer: SortableRegistryEntry, toIndex: number): void {
        const item = this.draggedItem();
        if (item === null) return;
        const result = peer.canAccept(item, { fromListId: this.resolvedListId(), toIndex });
        const norm = this.normalizeAccept(result);
        peer.setRejectReason(norm.ok ? null : (norm.reason ?? 'rejected'));
    }

    private onDragEnd(): void {
        const from = this._dragSource();
        this.dragCleanup = null;

        if (from === null) {
            this.clearDragState();
            return;
        }

        const peer = this._hoverPeer();
        if (peer !== null) {
            this.commitCrossListDrop(from, peer);
            return;
        }

        const gap = this._dragTarget();
        if (gap === null) {
            // No gap ever computed (release before any move) — still animate
            // the source back from its translated position via FLIP.
            this.flip.measure();
            this.clearDragState();
            this.schedulePlay();
            return;
        }
        const to = gap > from ? gap - 1 : gap;
        this.applyReorder(from, to, { clearDrag: true, emit: true });
    }

    private commitCrossListDrop(from: number, peer: SortableRegistryEntry): void {
        const item = this.items()[from];
        const targetIndex = this._hoverPeerTarget() ?? 0;
        const ctx: ForeignDropContext = { fromListId: this.resolvedListId(), toIndex: targetIndex };
        const norm = this.normalizeAccept(peer.canAccept(item, ctx));

        if (!norm.ok) {
            peer.onForeignLeave();
            this.clearDragState();
            this.dropRejected.emit({
                item,
                fromListId: this.resolvedListId(),
                toListId: peer.listId,
                toIndex: targetIndex,
                reason: norm.reason,
            });
            return;
        }

        peer.onForeignLeave();
        this.flip.measure();
        this.clearDragState();
        const next = [...this.items()];
        next.splice(from, 1);
        this.items.set(next);
        peer.receiveItem(item, targetIndex);
        this.reorder.emit({
            from: { listId: this.resolvedListId(), index: from },
            to: { listId: peer.listId, index: targetIndex },
            item,
        });
        this.schedulePlay();
    }

    private clearDragState(): void {
        this._dragSource.set(null);
        this._dragTarget.set(null);
        this._dragDelta.set({ x: 0, y: 0 });
        this._placeholderRect.set(null);
        this._hoverPeer.set(null);
        this._hoverPeerTarget.set(null);
        this.dragStartLength = null;
        this.autoScroller?.stop();
        this.autoScroller = null;
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

        if (event.key === 'Home') {
            event.preventDefault();
            this.keyboardMoveToIndex(index, 0);
            return;
        }
        if (event.key === 'End') {
            event.preventDefault();
            this.keyboardMoveToIndex(index, this.items().length - 1);
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            this.keyboardCrossList(index, event.shiftKey ? -1 : 1);
            return;
        }

        const delta = this.arrowDelta(event.key);
        if (delta === 0) return;
        event.preventDefault();

        const newIndex = Math.max(0, Math.min(this.items().length - 1, index + delta));
        this.keyboardMoveToIndex(index, newIndex);
    }

    private keyboardMoveToIndex(fromIndex: number, toIndex: number): void {
        if (toIndex === fromIndex) return;
        this.applyReorder(fromIndex, toIndex, { clearDrag: false, emit: true });
        this._liftedIndex.set(toIndex);
        this.ariaLive.announce(this.currentLocale().moved(toIndex + 1, this.items().length));
    }

    /** Hand the lifted item off to the next or previous peer in the same group. */
    private keyboardCrossList(fromIndex: number, direction: 1 | -1): void {
        const groupName = this.group();
        if (groupName === '') return;
        const allPeers = peersInGroup(groupName);
        const selfIdx = allPeers.indexOf(this.registryEntry);
        if (selfIdx === -1 || allPeers.length < 2) return;
        const peerIdx = (selfIdx + direction + allPeers.length) % allPeers.length;
        if (peerIdx === selfIdx) return;
        const peer = allPeers[peerIdx];

        const item = this.items()[fromIndex];
        const peerExistingCount = peer.getItemRects().length;
        const targetIndex = peerExistingCount;

        const norm = this.normalizeAccept(peer.canAccept(item, { fromListId: this.resolvedListId(), toIndex: targetIndex }));
        if (!norm.ok) {
            this.ariaLive.announce(this.currentLocale().rejected(norm.reason));
            this.dropRejected.emit({
                item,
                fromListId: this.resolvedListId(),
                toListId: peer.listId,
                toIndex: targetIndex,
                reason: norm.reason,
            });
            return;
        }

        this.flip.measure();
        const next = [...this.items()];
        next.splice(fromIndex, 1);
        this.items.set(next);
        peer.receiveItem(item, targetIndex);
        this._liftedIndex.set(null);
        this._liftOrigin.set(null);
        this.reorder.emit({
            from: { listId: this.resolvedListId(), index: fromIndex },
            to: { listId: peer.listId, index: targetIndex },
            item,
        });
        const peerNewTotal = peerExistingCount + 1;
        this.ariaLive.announce(this.currentLocale().movedToList(peer.listId, targetIndex + 1, peerNewTotal));
        this.schedulePlay();
    }

    private handleKeyLiftOrDrop(index: number, lifted: number | null): void {
        if (lifted === null) {
            this._liftedIndex.set(index);
            this._liftOrigin.set(index);
            const total = this.items().length;
            this.ariaLive.announce(this.currentLocale().pickedUp(this.itemLabel(index), index + 1, total));
        } else {
            this._liftedIndex.set(null);
            this._liftOrigin.set(null);
            this.ariaLive.announce(this.currentLocale().dropped(lifted + 1));
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
        this.ariaLive.announce(this.currentLocale().cancelled);
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
