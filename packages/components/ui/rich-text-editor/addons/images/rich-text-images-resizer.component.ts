import { Component, signal, input, effect, OnDestroy, ChangeDetectionStrategy, output, inject, computed } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ImageAlignment, applyImageAlignment } from './rich-text-images.utils';

export type { ImageAlignment } from './rich-text-images.utils';

/** The five resize/align overlay labels, resolved from the addon locale. */
export interface RichTextImageResizerLabels {
    readonly inline: string;
    readonly floatLeft: string;
    readonly center: string;
    readonly floatRight: string;
    readonly deleteImage: string;
}

const DEFAULT_RESIZER_LABELS: RichTextImageResizerLabels = {
    inline: 'Inline',
    floatLeft: 'Float left',
    center: 'Center',
    floatRight: 'Float right',
    deleteImage: 'Delete image',
};

/** Resize handle position — four corners plus four edges (single-axis). */
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

interface ResizeState {
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    handle: ResizeHandle;
}

/** Per-handle sign for the width delta (drag-right). 0 = width unaffected. */
const WIDTH_SIGN: Record<ResizeHandle, number> = {
    nw: -1, w: -1, sw: -1,
    ne: 1, e: 1, se: 1,
    n: 0, s: 0,
};

/** Per-handle sign for the height delta (drag-down). 0 = height unaffected. */
const HEIGHT_SIGN: Record<ResizeHandle, number> = {
    nw: -1, n: -1, ne: -1,
    sw: 1, s: 1, se: 1,
    e: 0, w: 0,
};

const ALIGNMENT_ICONS: Record<ImageAlignment, string> = {
    inline: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6H3"/><path d="M21 12H3"/><path d="M15.5 18H3"/><rect x="15" y="5" width="6" height="4" rx="1" fill="currentColor" opacity="0.3" stroke="none"/></svg>`,
    left: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="7" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor"/><path d="M14 5h7"/><path d="M14 9h7"/><path d="M3 14h18"/><path d="M3 18h18"/></svg>`,
    center: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="8" height="7" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor"/><path d="M3 14h18"/><path d="M3 18h18"/></svg>`,
    right: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="13" y="3" width="8" height="7" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor"/><path d="M3 5h7"/><path d="M3 9h7"/><path d="M3 14h18"/><path d="M3 18h18"/></svg>`,
};

/** Normalize a mouse or touch event to a single client-space point. */
function pointFromEvent(event: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
    if ('touches' in event) {
        const touch = event.touches[0] ?? event.changedTouches[0];
        return { clientX: touch.clientX, clientY: touch.clientY };
    }
    return { clientX: event.clientX, clientY: event.clientY };
}

const DELETE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

/** Spoken names for the eight drag handles. */
const RESIZE_HANDLE_LABELS: Readonly<Record<string, string>> = {
    nw: 'Resize from top left',
    ne: 'Resize from top right',
    sw: 'Resize from bottom left',
    se: 'Resize from bottom right',
    n: 'Resize from top',
    s: 'Resize from bottom',
    w: 'Resize from left',
    e: 'Resize from right',
};

/** Pixels one arrow-key press changes the image by, and with Shift held. */
const KEYBOARD_RESIZE_STEP = 10;
const KEYBOARD_RESIZE_STEP_LARGE = 50;

/** Which way each arrow key pushes, per axis. */
const KEYBOARD_RESIZE_DELTA: Readonly<Record<string, { x: number; y: number } | undefined>> = {
    ArrowRight: { x: 1, y: 0 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowDown: { x: 0, y: 1 },
    ArrowUp: { x: 0, y: -1 },
};

/** How long a run of keypresses is folded into one history entry. */
const KEYBOARD_RESIZE_COALESCE_MS = 400;

/** Absolute pixel bound for a resized image on either axis. */
const MAX_IMAGE_DIMENSION = 10000;

@Component({
    selector: 'ui-rich-text-image-resizer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './rich-text-images-resizer.component.html',
})
export class RichTextImageResizerComponent implements OnDestroy {
    private readonly document = inject(DOCUMENT);
    private readonly sanitizer = inject(DomSanitizer);
    /**
     * The image to decorate. Setting it starts tracking (a `ResizeObserver` on
     * the image and {@link container}, plus scroll/window-resize listeners);
     * clearing it to `null` tears all of that down and hides the overlay. The
     * image is mutated in place — inline `width`/`height` while dragging,
     * `data-align` plus float/margin styles on alignment.
     */
    readonly target = input<HTMLImageElement | null>(null);
    /**
     * The positioned element the overlay box is laid out inside. All handle
     * coordinates are the target's rect minus this element's rect, and the
     * overlay hides itself when the image scrolls fully out of this box.
     */
    readonly container = input<HTMLElement | null>(null);
    /**
     * Button titles for the four alignment buttons and delete. Defaults to
     * English; the images addon feeds the translated set.
     */
    readonly labels = input<RichTextImageResizerLabels>(DEFAULT_RESIZER_LABELS);
    /** Show the corner resize handles. */
    readonly resizable = input<boolean>(true);
    /** Show the alignment buttons in the overlay toolbar. */
    readonly showAlignment = input<boolean>(true);
    /** Lower clamp (px) for the dragged image, on both axes. */
    readonly minWidth = input<number>(20);
    /** Upper clamp (px) for the dragged image width. No ceiling when unset. */
    readonly maxWidth = input<number>();
    /** When false, corners resize axes independently and edge handles appear. */
    readonly lockAspectRatio = input<boolean>(true);
    /**
     * A drag ended (pointer released). Fires once per drag, not per move — the
     * size was already written to the image live, so this is the signal to
     * record one undo entry for the whole gesture.
     */
    readonly resizeEnd = output<void>();
    /**
     * An alignment button was pressed, after {@link applyImageAlignment} has
     * already restyled the image and stamped `data-align`. Emits the new value
     * for history/persistence, not as a request to apply it.
     */
    readonly alignmentChange = output<ImageAlignment>();
    /**
     * The delete button was pressed. Emits the target image without removing
     * it — the owner detaches it so the deletion is captured in undo history.
     */
    readonly imageRemove = output<HTMLImageElement>();

    readonly alignments: ImageAlignment[] = ['inline', 'left', 'center', 'right'];

    readonly resolvedAlignmentLabels = computed<Record<ImageAlignment, string>>(() => {
        const l = this.labels();
        return {
            inline: l.inline,
            left: l.floatLeft,
            center: l.center,
            right: l.floatRight,
        };
    });

    readonly rect = signal({ top: 0, left: 0, width: 0, height: 0 });
    readonly visible = signal(false);

    readonly currentAlignment = computed<ImageAlignment>(() => {
        const t = this.target();
        if (!t) return 'inline';
        return (t.dataset['align'] as ImageAlignment) || 'inline';
    });

    readonly deleteIconHtml: SafeHtml;

    private rafId: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private readonly onContainerScrollBound = (): void => this.scheduleUpdate();
    private readonly onWindowResizeBound = (): void => this.scheduleUpdate();
    private resizeState: ResizeState | null = null;
    private keyboardResizeTimer: ReturnType<typeof setTimeout> | null = null;

    private readonly onMoveBound = this.onPointerMove.bind(this);
    private readonly onUpBound = this.onPointerUp.bind(this);

    constructor() {
        this.deleteIconHtml = this.sanitizer.bypassSecurityTrustHtml(DELETE_ICON);

        effect(() => {
            const t = this.target();
            if (t) {
                this.startTracking();
            } else {
                this.stopTracking();
                this.visible.set(false);
            }
        });
    }

    /**
     * The inline SVG glyph for one alignment, pre-trusted for `[innerHTML]`.
     * The markup is a module-level constant, never consumer input, so the
     * sanitizer bypass carries no untrusted content.
     */
    getAlignIcon(align: ImageAlignment): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml(ALIGNMENT_ICONS[align]);
    }

    /**
     * Applies `align` to the target immediately (styles + `data-align`), then
     * emits {@link alignmentChange} and re-measures the overlay, since floating
     * the image moves it. Bound to both `mousedown` (so a pointer press does not
     * collapse the editor selection) and `click` (so keyboard activation works
     * at all); {@link consumedByMouse} keeps a mouse press from running twice.
     */
    onAlignClick(event: MouseEvent, align: ImageAlignment): void {
        event.preventDefault();
        event.stopPropagation();
        if (this.consumedByMouse(event)) return;
        const t = this.target();
        if (!t) return;

        t.dataset['align'] = align;
        applyImageAlignment(t, align);
        this.alignmentChange.emit(align);
        this.scheduleUpdate();
    }

    /**
     * Emits {@link imageRemove} with the current target and leaves the DOM
     * untouched — removal is the owner's job. Bound to `mousedown` and `click`
     * for the same reason as {@link onAlignClick}, and swallows the event so the
     * press doesn't collapse the editor selection.
     */
    onDeleteClick(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        if (this.consumedByMouse(event)) return;
        const t = this.target();
        if (!t) return;
        this.imageRemove.emit(t);
    }

    /**
     * True when this `click` merely follows a `mousedown` that already did the
     * work.
     *
     * The overlay buttons bind BOTH events on purpose. `mousedown` is what keeps
     * a pointer press from collapsing the editor selection, but it never fires
     * for a keyboard activation, so binding it alone left align and delete
     * completely dead for anyone pressing Enter -- the buttons were focusable
     * and inert. Binding `click` as well restores the keyboard; this guard stops
     * a pointer press, which fires both, from running the action twice.
     *
     * A keyboard-generated click reports `detail === 0`, which is how the two
     * are told apart.
     */
    private consumedByMouse(event: MouseEvent): boolean {
        return event.type === 'click' && event.detail > 0;
    }

    private startTracking(): void {
        this.stopTracking();
        const target = this.target();
        const container = this.container();

        this.resizeObserver = new ResizeObserver(() => this.scheduleUpdate());
        if (target) {
            this.resizeObserver.observe(target);
        }
        if (container) {
            this.resizeObserver.observe(container);
            container.addEventListener('scroll', this.onContainerScrollBound, { passive: true });
        }
        this.document.defaultView?.addEventListener('resize', this.onWindowResizeBound);
        this.scheduleUpdate();
    }

    private stopTracking(): void {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        this.container()?.removeEventListener('scroll', this.onContainerScrollBound);
        this.document.defaultView?.removeEventListener('resize', this.onWindowResizeBound);
    }

    private scheduleUpdate(): void {
        if (this.rafId !== null) {
            return;
        }
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.updateRect();
        });
    }

    private updateRect(): void {
        const t = this.target();
        const c = this.container();
        if (!t || !c) {
            this.visible.set(false);
            return;
        }

        const tRect = t.getBoundingClientRect();
        const cRect = c.getBoundingClientRect();

        if (tRect.bottom < cRect.top || tRect.top > cRect.bottom ||
            tRect.right < cRect.left || tRect.left > cRect.right) {
            this.visible.set(false);
            return;
        }

        this.rect.set({
            top: tRect.top - cRect.top,
            left: tRect.left - cRect.left,
            width: tRect.width,
            height: tRect.height
        });
        this.visible.set(true);
    }

    /**
     * Begins a drag from one handle. Serves both `mousedown` and `touchstart`
     * (the handles carry `touch-action: none`), snapshots the image's starting
     * rect, and attaches document-level move/up listeners for both pointer
     * kinds until release. Sizes are written straight onto the image as it
     * moves; only the release emits {@link resizeEnd}. Clamped by
     * {@link minWidth} / {@link maxWidth}, and constrained to the starting
     * aspect ratio while {@link lockAspectRatio} is true.
     */
    startResize(event: MouseEvent | TouchEvent, handle: ResizeHandle): void {
        event.preventDefault();
        event.stopPropagation();

        const t = this.target();
        if (!t) return;

        const point = pointFromEvent(event);
        const rect = t.getBoundingClientRect();
        this.resizeState = {
            startX: point.clientX,
            startY: point.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            handle
        };

        this.document.addEventListener('mousemove', this.onMoveBound);
        this.document.addEventListener('mouseup', this.onUpBound);
        this.document.addEventListener('touchmove', this.onMoveBound, { passive: false });
        this.document.addEventListener('touchend', this.onUpBound);
    }

    private onPointerMove(event: MouseEvent | TouchEvent): void {
        const state = this.resizeState;
        const t = this.target();
        if (!state || !t) return;

        if ('touches' in event) {
            event.preventDefault();
        }

        const point = pointFromEvent(event);
        const deltaX = point.clientX - state.startX;
        const deltaY = point.clientY - state.startY;
        const size = this.lockAspectRatio()
            ? this.lockedSize(state, deltaX)
            : this.freeSize(state, deltaX, deltaY);

        const min = this.minWidth();
        if (size.width >= min && size.height >= min) {
            t.style.width = `${size.width}px`;
            t.style.height = `${size.height}px`;
        }
    }

    /**
     * Resize the image from the keyboard.
     *
     * The eight drag handles are pointer-only by nature -- a drag has no
     * keyboard equivalent -- and they were bare divs with no tabindex, role or
     * key handling, so image resizing could not be done without a pointer at
     * all. This gives the overlay one focusable control that grows and shrinks
     * the image with the arrow keys, holding the aspect ratio when
     * {@link lockAspectRatio} asks for it. Shift moves in larger steps.
     */
    /**
     * Accessible name for one resize handle.
     *
     * The handles were bare divs -- no tabindex, no role, no name -- so image
     * resizing was strictly pointer-only. They are buttons now, and each says
     * which corner or edge it drags. The compass point is spelled out rather
     * than left as "nw" so it is pronounceable.
     */
    handleLabel(handle: ResizeHandle): string {
        return RESIZE_HANDLE_LABELS[handle];
    }

    onResizeKeydown(event: KeyboardEvent, handle: ResizeHandle): void {
        const arrow = KEYBOARD_RESIZE_DELTA[event.key];
        if (!arrow) return;

        const t = this.target();
        if (!t) return;

        const step = event.shiftKey ? KEYBOARD_RESIZE_STEP_LARGE : KEYBOARD_RESIZE_STEP;

        // Same sign tables the drag path uses, so a handle means the same thing
        // whichever way it is driven. Every handle used to grow the image on
        // ArrowRight -- the top-left corner grew it, which is backwards from
        // dragging that corner, and the n/s handles resized width despite
        // WIDTH_SIGN saying they do not touch it.
        const dx = arrow.x * step * WIDTH_SIGN[handle];
        const dy = arrow.y * step * HEIGHT_SIGN[handle];

        // Decide BEFORE consuming the event. A key this handle cannot act on --
        // including a vertical arrow on a corner while the aspect ratio is
        // locked, where the height just follows the width -- must stay with the
        // page, or the user presses Up on a focused handle, nothing happens, and
        // their scroll is silently eaten too.
        if (dx === 0 && (dy === 0 || this.lockAspectRatio())) return;

        event.preventDefault();
        event.stopPropagation();

        const rect = t.getBoundingClientRect();
        const aspect = rect.height === 0 ? 1 : rect.width / rect.height;

        // Both branches go through the same bounding as the drag path. The
        // locked branch used to derive height by an unclamped division -- the
        // identical defect that was fixed in lockedSize, 55 lines below, and
        // missed here because this block's own fixture sets lockAspectRatio to
        // false so every keyboard test ran the unlocked branch.
        const requested = this.clampWidth(Math.max(this.minWidth(), rect.width + dx));
        const { width, height } = this.lockAspectRatio()
            ? this.ratioBoundedSize(requested, aspect)
            : { width: requested, height: this.clampHeight(rect.height + dy) };

        t.style.width = `${width}px`;
        t.style.height = `${height}px`;
        this.scheduleUpdate();
        this.endKeyboardResizeSoon();
    }

    /**
     * Emit one {@link resizeEnd} for a run of keypresses.
     *
     * A whole mouse drag records one undo entry; the keyboard path emitted per
     * press, so undoing a keyboard resize took as many undos as the user made
     * presses. This coalesces a burst the way the drag does, and the pending
     * timer is cancelled on teardown so a destroyed overlay cannot emit.
     */
    private endKeyboardResizeSoon(): void {
        if (this.keyboardResizeTimer !== null) {
            clearTimeout(this.keyboardResizeTimer);
        }
        this.keyboardResizeTimer = setTimeout(() => {
            this.keyboardResizeTimer = null;
            this.resizeEnd.emit();
        }, KEYBOARD_RESIZE_COALESCE_MS);
    }

    /**
     * Clamp a width, symmetrically with {@link clampHeight}.
     *
     * The height fix was applied to only one of two mirror-image axes: width had
     * no lower bound (a fast leftward drag computed a negative width, which
     * onPointerMove then refused to write -- the "frozen drag" that fix claims
     * to have removed) and no ceiling at all when maxWidth is unset, which is
     * the default.
     */
    private clampWidth(width: number): number {
        const max = this.maxWidth() ?? MAX_IMAGE_DIMENSION;
        return Math.min(Math.min(max, MAX_IMAGE_DIMENSION), Math.max(this.minWidth(), width));
    }

    /**
     * Size with the aspect ratio held. BOTH axes are bounded here.
     *
     * Clamping width and then deriving height by division skipped the height
     * bound entirely: a 20x10000 image dragged out reached 5,000,000px. And
     * because `lockAspectRatio` defaults to true, that is the path most users
     * are on -- the earlier bounds fix, and both of its tests, only exercised
     * `freeSize`, the ratio-unlocked function.
     *
     * The ratio is preserved while clamping, so the image stays the shape it
     * was. Only the ceiling is enforced here; the floor belongs to
     * onPointerMove, which rejects an undersized drag rather than snapping it.
     */
    /**
     * Bound a width/height pair that must keep `aspect`, shared by the drag and
     * keyboard paths so neither can drift from the other.
     *
     * Only the CEILING is applied. The floor stays with onPointerMove, which
     * rejects an undersized result outright rather than snapping it -- raising a
     * too-small drag to the minimum would start writing sizes where the
     * component currently writes nothing.
     */
    private ratioBoundedSize(width: number, aspect: number): { width: number; height: number } {
        const height = width / aspect;
        if (height > MAX_IMAGE_DIMENSION) {
            return { width: MAX_IMAGE_DIMENSION * aspect, height: MAX_IMAGE_DIMENSION };
        }
        // The FLOOR is applied here too, on whichever axis reaches it first.
        // Leaving it to onPointerMove -- which refuses a write where either axis
        // is under the minimum -- froze the drag on any image wider than it is
        // tall: an 800x50 banner shrinking to 300px has a derived height of
        // 18.75px, so the write was rejected and the image simply stopped
        // responding at ~500px with no feedback. On the coupled path the gate
        // cannot be satisfied by shrinking further, so it has to be met here.
        const min = this.minWidth();
        if (height < min) return { width: min * aspect, height: min };
        if (width < min) return { width: min, height: min / aspect };
        return { width, height };
    }

    private lockedSize(state: ResizeState, deltaX: number): { width: number; height: number } {
        const aspect = state.startWidth / state.startHeight;
        const width = this.clampWidth(state.startWidth + WIDTH_SIGN[state.handle] * deltaX);
        return this.ratioBoundedSize(width, aspect);
    }

    private freeSize(state: ResizeState, deltaX: number, deltaY: number): { width: number; height: number } {
        const width = this.clampWidth(state.startWidth + WIDTH_SIGN[state.handle] * deltaX);
        // Height was clamped at neither end, so a fast drag could compute a
        // 100,000px height or a negative one. onPointerMove's `>= min` gate then
        // refused the write, which reads as the drag freezing rather than
        // stopping at the bound.
        const height = this.clampHeight(state.startHeight + HEIGHT_SIGN[state.handle] * deltaY);
        return { width, height };
    }

    /**
     * Clamp a height. {@link minWidth} is a shared lower bound for both axes --
     * an image thinner or shorter than that is not usable either way -- but
     * {@link maxWidth} is deliberately NOT applied here: it is a width ceiling,
     * and using it for height silently squashed every portrait image and
     * contradicted the input's own documentation. Height has no ceiling until
     * there is an input that means one.
     */
    private clampHeight(height: number): number {
        // A ceiling is still needed, just not the WIDTH one: a fast drag could
        // compute a 100,000px height, which onPointerMove then refused to write
        // -- reading as a frozen drag rather than a bound. The cap is generous
        // enough never to bite a real image.
        return Math.min(MAX_IMAGE_DIMENSION, Math.max(this.minWidth(), height));
    }

    private onPointerUp(): void {
        this.resizeState = null;
        this.removePointerListeners();
        this.resizeEnd.emit();
    }

    private removePointerListeners(): void {
        this.document.removeEventListener('mousemove', this.onMoveBound);
        this.document.removeEventListener('mouseup', this.onUpBound);
        this.document.removeEventListener('touchmove', this.onMoveBound);
        this.document.removeEventListener('touchend', this.onUpBound);
    }

    ngOnDestroy(): void {
        this.stopTracking();
        this.removePointerListeners();
        if (this.keyboardResizeTimer !== null) {
            clearTimeout(this.keyboardResizeTimer);
            this.keyboardResizeTimer = null;
        }
    }
}
