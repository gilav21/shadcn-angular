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

    registerTrigger(t: { focus(): void }): void { this.trigger = t; }
    registerContent(c: { focusFirst(): void }): void { this.content = c; }

    enter(): void {
        clearTimeout(this.timeoutId);
        this.isOpen.set(true);
    }

    leave(): void {
        this.timeoutId = setTimeout(() => {
            this.isOpen.set(false);
        }, 100);
    }

    focusTrigger(): void {
        setTimeout(() => {
            this.trigger?.focus();
        }, 0);
    }

    focusContent(): void {
        setTimeout(() => {
            this.content?.focusFirst();
        }, 0);
    }
}
