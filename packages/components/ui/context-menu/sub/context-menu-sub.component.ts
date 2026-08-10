import {
    Component,
    ChangeDetectionStrategy,
    signal,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import type { ContextMenuSubTriggerComponent } from './context-menu-sub-trigger.component';
import type { ContextMenuSubContentComponent } from './context-menu-sub-content.component';

export const CONTEXT_MENU_SUB = new InjectionToken<ContextMenuSubComponent>('CONTEXT_MENU_SUB');

@Component({
    selector: 'ui-context-menu-sub',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: CONTEXT_MENU_SUB, useExisting: forwardRef(() => ContextMenuSubComponent) }],
    template: `<ng-content />`,
    host: {
        class: 'relative block w-full',
        '[attr.data-slot]': '"context-menu-sub"',
    },
})
export class ContextMenuSubComponent {
    isOpen = signal(false);
    private timeoutId: ReturnType<typeof setTimeout> | undefined;

    private trigger: ContextMenuSubTriggerComponent | null = null;
    private content: ContextMenuSubContentComponent | null = null;

    /** Called by a projected `<ui-context-menu-sub-trigger>` from its constructor; the last one to register wins, so nest exactly one per sub. */
    registerTrigger(t: ContextMenuSubTriggerComponent): void { this.trigger = t; }
    /** Called by a projected `<ui-context-menu-sub-content>` from its constructor; the last one to register wins, so nest exactly one per sub. */
    registerContent(c: ContextMenuSubContentComponent): void { this.content = c; }

    /**
     * The registered trigger's inner row element, used by the content to
     * anchor its flyout. `null` before the trigger's view initialises or when
     * no trigger is projected — the content then skips positioning and stays
     * at its last coordinates.
     */
    getTriggerElement(): HTMLElement | null {
        return this.trigger?.triggerEl?.nativeElement ?? null;
    }

    /**
     * Opens the flyout immediately and cancels any pending close from
     * {@link leave} — which is what lets the pointer travel from the trigger
     * to the flyout without it vanishing, since both call this on
     * `mouseenter`. Idempotent while already open.
     */
    enter(): void {
        clearTimeout(this.timeoutId);
        this.isOpen.set(true);
    }

    /**
     * Schedules the flyout to close after a 100ms grace period, so a pointer
     * moving off the trigger and onto the flyout (or back) can cancel it via
     * {@link enter}. Keyboard closes go through the same method and therefore
     * also wait out the delay. The pending timer is not cleared on destroy.
     */
    leave(): void {
        this.timeoutId = setTimeout(() => {
            this.isOpen.set(false);
        }, 100);
    }

    /**
     * Returns focus to the branch trigger on the next macrotask, after the
     * flyout portal has been torn down — focusing synchronously would be
     * undone by the removal of the currently focused element. No-op if no
     * trigger has registered.
     */
    focusTrigger(): void {
        setTimeout(() => {
            this.trigger?.focus();
        }, 0);
    }

    /**
     * Moves focus into the flyout on the next macrotask, giving the portal
     * time to mount after {@link enter}. Delegates to
     * {@link ContextMenuSubContentComponent.focusFirst}, so it lands on the
     * first entry that matches `[role="menuitem"]:not([data-disabled])`.
     */
    focusContent(): void {
        setTimeout(() => {
            this.content?.focusFirst();
        }, 0);
    }
}
