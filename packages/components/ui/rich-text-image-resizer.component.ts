import { Component, signal, input, effect, OnDestroy, ChangeDetectionStrategy, output, inject, computed } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RichTextLocale, RICH_TEXT_LOCALES } from './rich-text-locales';

export type ImageAlignment = 'inline' | 'left' | 'center' | 'right';

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
    template: `
        @if (target()) {
            <div class="absolute border-2 border-primary pointer-events-none transition-none"
                 [style.top.px]="rect().top"
                 [style.left.px]="rect().left"
                 [style.width.px]="rect().width"
                 [style.height.px]="rect().height"
                 [style.display]="visible() ? 'block' : 'none'">

                <div class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-primary border border-white rounded-sm cursor-nw-resize pointer-events-auto shadow-sm"
                     (mousedown)="startResize($event, 'nw')"></div>
                <div class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-primary border border-white rounded-sm cursor-ne-resize pointer-events-auto shadow-sm"
                     (mousedown)="startResize($event, 'ne')"></div>
                <div class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-primary border border-white rounded-sm cursor-sw-resize pointer-events-auto shadow-sm"
                     (mousedown)="startResize($event, 'sw')"></div>
                <div class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-primary border border-white rounded-sm cursor-se-resize pointer-events-auto shadow-sm"
                     (mousedown)="startResize($event, 'se')"></div>

                <div class="absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-0.5 bg-popover border rounded-md shadow-md p-0.5">
                    @for (align of alignments; track align) {
                        <button
                            type="button"
                            class="p-1.5 rounded-sm hover:bg-accent transition-colors"
                            [class.bg-accent]="currentAlignment() === align"
                            [class.text-accent-foreground]="currentAlignment() === align"
                            [title]="resolvedAlignmentLabels()[align]"
                            (mousedown)="onAlignClick($event, align)">
                            <span [innerHTML]="getAlignIcon(align)"></span>
                        </button>
                    }
                    <div class="w-px h-5 bg-border mx-0.5"></div>
                    <button
                        type="button"
                        class="p-1.5 rounded-sm hover:bg-destructive/10 hover:text-destructive transition-colors"
                        [title]="locale().imageResizer.deleteImage"
                        (mousedown)="onDeleteClick($event)">
                        <span [innerHTML]="deleteIconHtml"></span>
                    </button>
                </div>
            </div>
        }
    `
})
export class RichTextImageResizerComponent implements OnDestroy {
    private readonly document = inject(DOCUMENT);
    private readonly sanitizer = inject(DomSanitizer);
    target = input<HTMLImageElement | null>(null);
    container = input<HTMLElement | null>(null);
    locale = input<RichTextLocale>(RICH_TEXT_LOCALES['en']);
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
        return (t.getAttribute('data-align') as ImageAlignment) || 'inline';
    });

    deleteIconHtml: SafeHtml;

    private rafId: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private readonly onContainerScrollBound = () => this.scheduleUpdate();
    private readonly onWindowResizeBound = () => this.scheduleUpdate();
    private resizeState: {
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
        handle: 'nw' | 'ne' | 'sw' | 'se';
    } | null = null;

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

        t.setAttribute('data-align', align);
        this.applyAlignmentStyles(t, align);
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

    applyAlignmentStyles(img: HTMLImageElement, align: ImageAlignment): void {
        img.style.removeProperty('float');
        img.style.removeProperty('display');
        img.style.removeProperty('margin');
        img.style.removeProperty('margin-left');
        img.style.removeProperty('margin-right');

        switch (align) {
            case 'inline':
                img.style.display = 'inline';
                img.style.margin = '0';
                break;
            case 'left':
                img.style.display = 'block';
                img.style.float = 'left';
                img.style.marginRight = '12px';
                img.style.marginBottom = '4px';
                break;
            case 'center':
                img.style.display = 'block';
                img.style.marginLeft = 'auto';
                img.style.marginRight = 'auto';
                break;
            case 'right':
                img.style.display = 'block';
                img.style.float = 'right';
                img.style.marginLeft = '12px';
                img.style.marginBottom = '4px';
                break;
        }
    }

    private startTracking() {
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

    private stopTracking() {
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

    private scheduleUpdate() {
        if (this.rafId !== null) {
            return;
        }
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.updateRect();
        });
    }

    private updateRect() {
        const t = this.target();
        const c = this.container();
        if (!t || !c) {
            this.visible.set(false);
            return;
        }

        const tRect = t.getBoundingClientRect();
        const cRect = c.getBoundingClientRect();

        this.rect.set({
            top: tRect.top - cRect.top + c.scrollTop,
            left: tRect.left - cRect.left + c.scrollLeft,
            width: tRect.width,
            height: tRect.height
        });
        this.visible.set(true);
    }

    startResize(event: MouseEvent, handle: 'nw' | 'ne' | 'sw' | 'se') {
        event.preventDefault();
        event.stopPropagation();

        const t = this.target();
        if (!t) return;

        this.resizeState = {
            startX: event.clientX,
            startY: event.clientY,
            startWidth: t.width,
            startHeight: t.height,
            handle
        };

        const rect = t.getBoundingClientRect();
        this.resizeState.startWidth = rect.width;
        this.resizeState.startHeight = rect.height;

        document.addEventListener('mousemove', this.onMouseMoveBound);
        document.addEventListener('mouseup', this.onMouseUpBound);
    }

    private onMouseMove(event: MouseEvent) {
        if (!this.resizeState || !this.target()) return;

        const deltaX = event.clientX - this.resizeState.startX;

        let newWidth = this.resizeState.startWidth;

        const aspect = this.resizeState.startWidth / this.resizeState.startHeight;

        switch (this.resizeState.handle) {
            case 'se':
            case 'ne':
                newWidth += deltaX;
                break;
            case 'sw':
            case 'nw':
                newWidth -= deltaX;
                break;
        }

        const newHeight = newWidth / aspect;

        if (newWidth > 20 && newHeight > 20) {
            const t = this.target()!;
            t.style.width = `${newWidth}px`;
            t.style.height = `${newHeight}px`;
        }
    }

    private onMouseUp() {
        this.resizeState = null;
        document.removeEventListener('mousemove', this.onMouseMoveBound);
        document.removeEventListener('mouseup', this.onMouseUpBound);
        this.resizeEnd.emit();
    }

    ngOnDestroy() {
        this.stopTracking();
        document.removeEventListener('mousemove', this.onMouseMoveBound);
        document.removeEventListener('mouseup', this.onMouseUpBound);
    }
}
