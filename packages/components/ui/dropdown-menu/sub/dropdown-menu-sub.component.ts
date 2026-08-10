import {
    ChangeDetectionStrategy,
    Component,
    forwardRef,
    InjectionToken,
    signal,
} from '@angular/core';

export const DROPDOWN_MENU_SUB = new InjectionToken<DropdownMenuSubComponent>('DROPDOWN_MENU_SUB');

@Component({
    selector: 'ui-dropdown-menu-sub',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        { provide: DROPDOWN_MENU_SUB, useExisting: forwardRef(() => DropdownMenuSubComponent) },
    ],
    template: `<ng-content />`,
    host: { class: 'relative block w-full' },
})
export class DropdownMenuSubComponent {
    isOpen = signal(false);
    private timeoutId: ReturnType<typeof setTimeout> | undefined;

    private trigger: { focus(): void } | null = null;
    private content: { focusFirst(): void } | null = null;

    /** Called by the child `<ui-dropdown-menu-sub-trigger>` so {@link focusTrigger} has a target. */
    registerTrigger(t: { focus(): void }): void { this.trigger = t; }
    /** Called by the child `<ui-dropdown-menu-sub-content>` so {@link focusContent} has a target. */
    registerContent(c: { focusFirst(): void }): void { this.content = c; }

    /**
     * Opens the submenu and cancels any pending close from {@link leave} —
     * which is what lets the pointer cross the gap between trigger and panel
     * without the panel disappearing.
     */
    enter(): void {
        clearTimeout(this.timeoutId);
        this.isOpen.set(true);
    }

    /**
     * Schedules the close after a 100 ms grace period rather than closing
     * immediately, so a later {@link enter} can cancel it. The submenu is still
     * open when this returns.
     */
    leave(): void {
        this.timeoutId = setTimeout(() => {
            this.isOpen.set(false);
        }, 100);
    }

    /**
     * Focuses the submenu trigger on the next tick, so it survives the close
     * this normally follows. A no-op until the trigger has registered.
     */
    focusTrigger(): void {
        setTimeout(() => {
            this.trigger?.focus();
        }, 0);
    }

    /**
     * Focuses the submenu's first enabled item on the next tick — deferred
     * because {@link enter} has not rendered the panel yet when this is called
     * alongside it.
     */
    focusContent(): void {
        setTimeout(() => {
            this.content?.focusFirst();
        }, 0);
    }
}
