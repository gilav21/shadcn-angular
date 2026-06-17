import { Component, signal, input, effect, OnDestroy, ChangeDetectionStrategy, output, inject, computed } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RichTextLocale, RICH_TEXT_LOCALES } from '../rich-text-locales';
import { ImageAlignment, applyImageAlignment } from '../rich-text-image.utils';

export type { ImageAlignment } from '../rich-text-image.utils';

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

const DELETE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

@Component({
    selector: 'ui-rich-text-image-resizer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './rich-text-image-resizer.component.html',
})
export class RichTextImageResizerComponent implements OnDestroy {
    private readonly document = inject(DOCUMENT);
    private readonly sanitizer = inject(DomSanitizer);
    target = input<HTMLImageElement | null>(null);
    container = input<HTMLElement | null>(null);
    locale = input<RichTextLocale>(RICH_TEXT_LOCALES['en']);
    /** Show the corner resize handles. */
    resizable = input<boolean>(true);
    /** Show the alignment buttons in the overlay toolbar. */
    showAlignment = input<boolean>(true);
    /** Lower clamp (px) for the dragged image width/height. */
    minWidth = input<number>(20);
    /** Upper clamp (px) for the dragged image width. No ceiling when unset. */
    maxWidth = input<number>();
    /** When false, corners resize axes independently and edge handles appear. */
    lockAspectRatio = input<boolean>(true);
    resizeEnd = output<void>();
    alignmentChange = output<ImageAlignment>();
    imageRemove = output<HTMLImageElement>();

    readonly alignments: ImageAlignment[] = ['inline', 'left', 'center', 'right'];

    resolvedAlignmentLabels = computed<Record<ImageAlignment, string>>(() => {
        const l = this.locale().imageResizer;
        return {
            inline: l.inline,
            left: l.floatLeft,
            center: l.center,
            right: l.floatRight,
        };
    });

    rect = signal({ top: 0, left: 0, width: 0, height: 0 });
    visible = signal(false);

    currentAlignment = computed<ImageAlignment>(() => {
        const t = this.target();
        if (!t) return 'inline';
        return (t.dataset['align'] as ImageAlignment) || 'inline';
    });

    deleteIconHtml: SafeHtml;

    private rafId: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private readonly onContainerScrollBound = (): void => this.scheduleUpdate();
    private readonly onWindowResizeBound = (): void => this.scheduleUpdate();
    private resizeState: ResizeState | null = null;

    private readonly onMouseMoveBound = this.onMouseMove.bind(this);
    private readonly onMouseUpBound = this.onMouseUp.bind(this);

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

    getAlignIcon(align: ImageAlignment): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml(ALIGNMENT_ICONS[align]);
    }

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

    startResize(event: MouseEvent, handle: ResizeHandle): void {
        event.preventDefault();
        event.stopPropagation();

        const t = this.target();
        if (!t) return;

        const rect = t.getBoundingClientRect();
        this.resizeState = {
            startX: event.clientX,
            startY: event.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            handle
        };

        document.addEventListener('mousemove', this.onMouseMoveBound);
        document.addEventListener('mouseup', this.onMouseUpBound);
    }

    private onMouseMove(event: MouseEvent): void {
        const state = this.resizeState;
        const t = this.target();
        if (!state || !t) return;

        const deltaX = event.clientX - state.startX;
        const deltaY = event.clientY - state.startY;
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

    private onMouseUp(): void {
        this.resizeState = null;
        document.removeEventListener('mousemove', this.onMouseMoveBound);
        document.removeEventListener('mouseup', this.onMouseUpBound);
        this.resizeEnd.emit();
    }

    ngOnDestroy(): void {
        this.stopTracking();
        document.removeEventListener('mousemove', this.onMouseMoveBound);
        document.removeEventListener('mouseup', this.onMouseUpBound);
    }
}
