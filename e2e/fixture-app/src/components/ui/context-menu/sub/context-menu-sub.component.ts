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

    registerTrigger(t: ContextMenuSubTriggerComponent): void { this.trigger = t; }
    registerContent(c: ContextMenuSubContentComponent): void { this.content = c; }

    getTriggerElement(): HTMLElement | null {
        return this.trigger?.triggerEl?.nativeElement ?? null;
    }

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
