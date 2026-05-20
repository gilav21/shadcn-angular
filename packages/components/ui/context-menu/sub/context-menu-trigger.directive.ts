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
    readonly uiContextMenuTrigger = input.required<ContextMenuComponent>();

    private readonly el = inject(ElementRef);
    private cleanupLongPress: (() => void) | null = null;

    ngAfterViewInit() {
        this.cleanupLongPress = onLongPress(this.el.nativeElement as HTMLElement, (event: TouchEvent) => {
            event.preventDefault();
            const touch = event.touches[0] ?? event.changedTouches[0];
            const contextMenu = this.uiContextMenuTrigger();
            if (touch && contextMenu) {
                contextMenu.show(touch.clientX, touch.clientY);
            }
        });
    }

    ngOnDestroy() {
        this.cleanupLongPress?.();
    }

    onContextMenu(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();

        const contextMenu = this.uiContextMenuTrigger();
        if (!contextMenu) return;

        contextMenu.show(event.clientX, event.clientY);
    }

    onClick(event: MouseEvent) {
        const contextMenu = this.uiContextMenuTrigger();
        if (contextMenu?.open()) {
            contextMenu.close();
        }
    }
}
