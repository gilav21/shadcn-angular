import { Component, signal, input, effect, OnDestroy, ChangeDetectionStrategy, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DOCUMENT } from '@angular/common';

@Component({
    selector: 'ui-rich-text-image-resizer',
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (target()) {
            <div class="absolute border-2 border-primary pointer-events-none transition-none"
                 [style.top.px]="rect().top"
                 [style.left.px]="rect().left"
                 [style.width.px]="rect().width"
                 [style.height.px]="rect().height"
                 [style.display]="visible() ? 'block' : 'none'">
                 
                <!-- Handles -->
                <!-- NW -->
                <div class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-primary border border-white rounded-sm cursor-nw-resize pointer-events-auto shadow-sm"
                     (mousedown)="startResize($event, 'nw')"></div>
                <!-- NE -->
                <div class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-primary border border-white rounded-sm cursor-ne-resize pointer-events-auto shadow-sm"
                     (mousedown)="startResize($event, 'ne')"></div>
                <!-- SW -->
                <div class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-primary border border-white rounded-sm cursor-sw-resize pointer-events-auto shadow-sm"
                     (mousedown)="startResize($event, 'sw')"></div>
                <!-- SE -->
                <div class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-primary border border-white rounded-sm cursor-se-resize pointer-events-auto shadow-sm"
                     (mousedown)="startResize($event, 'se')"></div>
            </div>
        }
    `
})
export class RichTextImageResizerComponent implements OnDestroy {
    private readonly document = inject(DOCUMENT);
    target = input<HTMLImageElement | null>(null);
    container = input<HTMLElement | null>(null);
    resizeEnd = output<void>();

    rect = signal({ top: 0, left: 0, width: 0, height: 0 });
    visible = signal(false);

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
        const deltaY = event.clientY - this.resizeState.startY;

        let newWidth = this.resizeState.startWidth;
        let newHeight = this.resizeState.startHeight;

        const aspect = this.resizeState.startWidth / this.resizeState.startHeight;

        switch (this.resizeState.handle) {
            case 'se':
                newWidth += deltaX;
                newHeight = newWidth / aspect;
                break;
            case 'sw':
                newWidth -= deltaX;
                newHeight = newWidth / aspect;
                break;
            case 'ne':
                newWidth += deltaX;
                newHeight = newWidth / aspect;
                break;
            case 'nw':
                newWidth -= deltaX;
                newHeight = newWidth / aspect;
                break;
        }

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
    }

    ngOnDestroy() {
        this.stopTracking();
        document.removeEventListener('mousemove', this.onMouseMoveBound);
        document.removeEventListener('mouseup', this.onMouseUpBound);
    }
}
