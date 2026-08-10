import {
    Component,
    ChangeDetectionStrategy,
    inject,
    ElementRef,
    OnDestroy,
    AfterViewInit,
    ViewChild,
} from '@angular/core';
import { onLongPress } from '../../../lib/touch';
import { CONTEXT_MENU } from '../context-menu.component';

@Component({
    selector: 'ui-context-menu-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
        #triggerSpan
        class="contents"
        (contextmenu)="onContextMenu($event)"
        [attr.data-slot]="'context-menu-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class ContextMenuTriggerComponent implements AfterViewInit, OnDestroy {
    private readonly contextMenu = inject(CONTEXT_MENU, { optional: true });

    @ViewChild('triggerSpan', { static: true }) private readonly triggerSpan!: ElementRef<HTMLElement>;

    private cleanupLongPress: (() => void) | null = null;

    ngAfterViewInit(): void {
        this.cleanupLongPress = onLongPress(this.triggerSpan.nativeElement, (event: TouchEvent) => {
            event.preventDefault();
            const touch = event.touches[0] ?? event.changedTouches[0];
            if (touch) {
                this.contextMenu?.show(touch.clientX, touch.clientY);
            }
        });
    }

    ngOnDestroy(): void {
        this.cleanupLongPress?.();
    }

    /**
     * Suppresses the browser's native context menu and opens the enclosing
     * `<ui-context-menu>` at the pointer. Touch users get the same result from
     * a 500ms long-press (cancelled if the finger moves more than 10px), wired
     * up in `ngAfterViewInit`. Bound on the wrapper `<span class="contents">`,
     * so the event must originate from projected content; the menu also needs
     * to be an ancestor — without one this is a no-op. Use
     * `[uiContextMenuTrigger]` instead to trigger a menu declared elsewhere.
     */
    onContextMenu(event: MouseEvent): void {
        event.preventDefault();
        this.contextMenu?.show(event.clientX, event.clientY);
    }
}
