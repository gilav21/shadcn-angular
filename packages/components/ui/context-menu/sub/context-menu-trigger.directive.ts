import {
    Directive,
    input,
    inject,
    ElementRef,
    OnDestroy,
    AfterViewInit,
} from '@angular/core';
import { onLongPress } from '../../../lib/touch';
import type { ContextMenuComponent } from '../context-menu.component';

/**
 * ContextMenuTriggerDirective - Directive version for use on any element
 *
 * Usage:
 * <ui-context-menu #contextMenu>
 *   <ui-context-menu-content>
 *     <ui-context-menu-item>Action 1</ui-context-menu-item>
 *     <ui-context-menu-item>Action 2</ui-context-menu-item>
 *   </ui-context-menu-content>
 * </ui-context-menu>
 *
 * <div [uiContextMenuTrigger]="contextMenu">
 *   Right-click anywhere here
 * </div>
 */
@Directive({
    selector: '[uiContextMenuTrigger]',
    host: {
        '(contextmenu)': 'onContextMenu($event)',
        '(click)': 'onClick($event)',
    },
})
export class ContextMenuTriggerDirective implements AfterViewInit, OnDestroy {
    /**
     * The menu instance this element opens — bind a template reference to the
     * `<ui-context-menu>` (e.g. `[uiContextMenuTrigger]="contextMenu"`). Unlike
     * `<ui-context-menu-trigger>`, the menu need not be an ancestor, so one
     * menu can be shared by many triggers; pair that with
     * `ContextMenuComponent.show`'s `data` argument to tell them apart.
     * Required — omitting it is a compile-time error.
     */
    readonly uiContextMenuTrigger = input.required<ContextMenuComponent>();

    private readonly el = inject(ElementRef);
    private cleanupLongPress: (() => void) | null = null;

    ngAfterViewInit(): void {
        this.cleanupLongPress = onLongPress(this.el.nativeElement as HTMLElement, (event: TouchEvent) => {
            event.preventDefault();
            const touch = event.touches[0] ?? event.changedTouches[0];
            const contextMenu = this.uiContextMenuTrigger();
            if (touch && contextMenu) {
                contextMenu.show(touch.clientX, touch.clientY);
            }
        });
    }

    ngOnDestroy(): void {
        this.cleanupLongPress?.();
    }

    /**
     * Suppresses the native context menu and opens {@link uiContextMenuTrigger}
     * at the pointer. Propagation is stopped, so nesting triggers opens only
     * the innermost one and an outer element's own `(contextmenu)` handler will
     * not run. Touch users get the same result from a 500ms long-press
     * (cancelled if the finger moves more than 10px). No `data` is passed to
     * `show()` — call it yourself if the menu needs to know its target.
     */
    onContextMenu(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();

        const contextMenu = this.uiContextMenuTrigger();
        if (!contextMenu) return;

        contextMenu.show(event.clientX, event.clientY);
    }

    /**
     * Dismisses the menu when the host is left-clicked while it is open, so a
     * plain click on the same element that opened it acts as a toggle-off. The
     * menu's own document-level capture listener already closes on any click
     * outside the portal, so this mainly guarantees the behaviour if that
     * listener is prevented from firing. The event is otherwise untouched — it
     * still bubbles and any other `(click)` handler on the element runs.
     */
    onClick(_event: MouseEvent): void {
        const contextMenu = this.uiContextMenuTrigger();
        if (contextMenu?.open()) {
            contextMenu.close();
        }
    }
}
