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
    /** Lower clamp (px) for the dragged image width/height. */
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
     * the image moves it. Bound to `mousedown` rather than `click` and swallows
     * the event so the editor's selection survives the press.
     */
    onAlignClick(event: MouseEvent, align: ImageAlignment): void {
        event.preventDefault();
        event.stopPropagation();
        const t = this.target();
        if (!t) return;

        t.dataset['align'] = align;
        applyImageAlignment(t, align);
        this.alignmentChange.emit(align);
        this.scheduleUpdate();
    }

    /**
     * Emits {@link imageRemove} with the current target and leaves the DOM
     * untouched — removal is the owner's job. Also `mousedown`-bound and
     * event-swallowing so the press doesn't collapse the editor selection.
     */
    onDeleteClick(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        const t = this.target();
        if (!t) return;
        this.imageRemove.emit(t);
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

        document.addEventListener('mousemove', this.onMoveBound);
        document.addEventListener('mouseup', this.onUpBound);
        document.addEventListener('touchmove', this.onMoveBound, { passive: false });
        document.addEventListener('touchend', this.onUpBound);
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

    private clampWidth(width: number): number {
        const max = this.maxWidth();
        return max === undefined ? width : Math.min(width, max);
    }

    private lockedSize(state: ResizeState, deltaX: number): { width: number; height: number } {
        const aspect = state.startWidth / state.startHeight;
        const width = this.clampWidth(state.startWidth + WIDTH_SIGN[state.handle] * deltaX);
        return { width, height: width / aspect };
    }

    private freeSize(state: ResizeState, deltaX: number, deltaY: number): { width: number; height: number } {
        const width = this.clampWidth(state.startWidth + WIDTH_SIGN[state.handle] * deltaX);
        const height = state.startHeight + HEIGHT_SIGN[state.handle] * deltaY;
        return { width, height };
    }

    private onPointerUp(): void {
        this.resizeState = null;
        this.removePointerListeners();
        this.resizeEnd.emit();
    }

    private removePointerListeners(): void {
        document.removeEventListener('mousemove', this.onMoveBound);
        document.removeEventListener('mouseup', this.onUpBound);
        document.removeEventListener('touchmove', this.onMoveBound);
        document.removeEventListener('touchend', this.onUpBound);
    }

    ngOnDestroy(): void {
        this.stopTracking();
        this.removePointerListeners();
    }
}
