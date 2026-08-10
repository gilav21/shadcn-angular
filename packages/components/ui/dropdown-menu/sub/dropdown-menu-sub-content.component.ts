import {
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { isTouchDevice } from '../../../lib/touch';
import { DropdownMenuService } from '../dropdown-menu.component';
import { DropdownMenuSubComponent } from './dropdown-menu-sub.component';

@Component({
    selector: 'ui-dropdown-menu-sub-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (sub.isOpen()) {
      <div
        [class]="classes()"
        role="menu"
        tabindex="-1"
        (mouseenter)="onMouseEnter()"
        (mouseleave)="onMouseLeave()"
        (keydown)="onKeydown($event)"
      >
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' }
})
export class DropdownMenuSubContentComponent {
    /** Extra classes merged onto the submenu panel, after the side/animation classes so they can override them. */
    class = input('');
    readonly sub = inject(DropdownMenuSubComponent);
    readonly service = inject(DropdownMenuService);
    readonly el = inject(ElementRef);

    constructor() {
        this.sub.registerContent(this);
    }

    /**
     * Cancels the trigger's pending close while the pointer is over the panel,
     * keeping the submenu open. Skipped on touch devices, where the trigger's
     * tap-to-toggle owns the state.
     */
    onMouseEnter(): void {
        if (isTouchDevice()) return;
        this.sub.enter();
    }

    /** Starts the grace-period close when the pointer leaves the panel. Skipped on touch devices. */
    onMouseLeave(): void {
        if (isTouchDevice()) return;
        this.sub.leave();
    }

    classes = computed(() => cn(
        'absolute top-0 z-50 min-w-[8rem] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'ltr:left-full ltr:ml-1 ltr:animate-in ltr:slide-in-from-left-1 ltr:fade-in-0 ltr:zoom-in-95',
        'rtl:right-full rtl:mr-1 rtl:animate-in rtl:slide-in-from-right-1 rtl:fade-in-0 rtl:zoom-in-95',
        this.class()
    ));

    /**
     * Moves focus to the submenu's first enabled item. Invoked by the parent
     * `<ui-dropdown-menu-sub>` when the submenu is opened from the keyboard.
     */
    focusFirst(): void {
        const items = Array.from((this.el.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        items[0]?.focus();
    }

    /**
     * Submenu key handler: arrows move focus with wraparound; Escape, and the
     * "back" arrow (ArrowLeft, or ArrowRight in RTL), close the submenu and
     * return focus to its trigger. Propagation is stopped so the root menu's
     * handler does not also act on the key — notably so Escape closes only the
     * submenu.
     */
    onKeydown(event: KeyboardEvent): void {
        event.stopPropagation();

        if (event.key === 'ArrowLeft') {
            if (!this.service.isRtl()) {
                event.preventDefault();
                this.sub.leave();
                this.sub.focusTrigger();
            }
        } else if (event.key === 'ArrowRight') {
            if (this.service.isRtl()) {
                event.preventDefault();
                this.sub.leave();
                this.sub.focusTrigger();
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.focusNextItem(event.target as HTMLElement);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.focusPrevItem(event.target as HTMLElement);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.sub.leave();
            this.sub.focusTrigger();
        }
    }

    /**
     * Focuses the item after `currentItem`, wrapping around. The ring is scoped
     * to the `role="menu"` that owns `currentItem`, so navigation stays inside
     * whichever submenu level has focus.
     */
    focusNextItem(currentItem: HTMLElement): void {
        const div = currentItem.closest<HTMLElement>('[role="menu"]') ?? currentItem;
        const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        const index = items.indexOf(currentItem);
        const nextIndex = (index + 1) % items.length;
        items[nextIndex]?.focus();
    }

    /**
     * Focuses the item before `currentItem`, wrapping around, scoped to that
     * item's own `role="menu"` — see {@link focusNextItem}.
     */
    focusPrevItem(currentItem: HTMLElement): void {
        const div = currentItem.closest<HTMLElement>('[role="menu"]') ?? currentItem;
        const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        const index = items.indexOf(currentItem);
        const prevIndex = (index - 1 + items.length) % items.length;
        items[prevIndex]?.focus();
    }
}
