import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    ElementRef,
    inject,
    input,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../../../lib/utils';
import { DROPDOWN_MENU, DropdownMenuService } from '../dropdown-menu.component';

@Component({
    selector: 'ui-dropdown-menu-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (menu?.open()) {
      <div
        [class]="classes()"
        [attr.data-slot]="'dropdown-content'"
        role="menu"
        tabindex="-1"
        (keydown)="onKeydown($event)"
      >
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class DropdownMenuContentComponent {
    readonly menu = inject(DROPDOWN_MENU, { optional: true });
    readonly service = inject(DropdownMenuService);
    readonly el = inject(ElementRef);
    private readonly document = inject(DOCUMENT);
    /** Extra classes merged onto the popup panel, after the alignment classes so they can override them. */
    class = input('');
    /**
     * Which edge of the panel lines up with the trigger — `start`/`end` flip
     * with text direction, `center` does not. Pure CSS anchoring with no
     * collision detection, so an `end`-aligned menu near the viewport edge can
     * still overflow.
     */
    align = input<'start' | 'center' | 'end'>('start');

    classes = computed(() => {
        const alignClasses = {
            start: 'ltr:left-0 rtl:right-0',
            center: 'left-1/2 -translate-x-1/2',
            end: 'ltr:right-0 rtl:left-0',
        };
        return cn(
            'absolute top-full z-50 mt-1 min-w-[8rem] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            alignClasses[this.align()],
            this.class()
        );
    });

    constructor() {
        effect(() => {
            if (this.menu?.open()) {
                setTimeout(() => {
                    this.focusFirstItem();
                });
            }
        });
    }

    /**
     * Moves focus to the first enabled item. Called automatically one tick
     * after the menu opens; call it manually only after changing the items
     * while open.
     */
    focusFirstItem(): void {
        const item = (this.el.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])');
        item?.focus();
    }

    /**
     * Menu key handler: arrows move focus with wraparound, Escape closes and
     * returns focus to the trigger, and Tab is trapped — it cycles within the
     * menu instead of leaving it, so the menu must be closed to tab onwards.
     */
    onKeydown(event: KeyboardEvent): void {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.focusNextItem(event.target as HTMLElement);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.focusPrevItem(event.target as HTMLElement);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.menu?.hide();
            this.service.focusTrigger();
        } else if (event.key === 'Tab') {
            event.preventDefault();
            const items = this.getFocusableItems();
            if (items.length === 0) return;

            const firstItem = items[0];
            const lastItem = items.at(-1);
            const activeElement = this.document.activeElement as HTMLElement;

            if (event.shiftKey) {
                if (activeElement === firstItem) {
                    lastItem?.focus();
                } else {
                    this.focusPrevItem(activeElement);
                }
            } else if (activeElement === lastItem) {
                    firstItem.focus();
                } else {
                    this.focusNextItem(activeElement);
                }
        }
    }

    /**
     * Focuses the item after `currentItem`, wrapping to the first. Passing an
     * element that is not in {@link getFocusableItems} focuses the first item.
     */
    focusNextItem(currentItem: HTMLElement): void {
        const items = this.getFocusableItems();
        const index = items.indexOf(currentItem);
        const nextIndex = (index + 1) % items.length;
        items[nextIndex]?.focus();
    }

    /**
     * Focuses the item before `currentItem`, wrapping to the last. Passing an
     * element that is not in {@link getFocusableItems} focuses the last item.
     */
    focusPrevItem(currentItem: HTMLElement): void {
        const items = this.getFocusableItems();
        const index = items.indexOf(currentItem);
        const prevIndex = (index - 1 + items.length) % items.length;
        items[prevIndex]?.focus();
    }

    /**
     * The menu's focus ring in DOM order: every `role="menuitem"` without
     * `data-disabled` that belongs to this panel directly. Queried live, and
     * scoped — items inside an open submenu belong to that submenu's own
     * `role="menu"` and stay out of the root ring.
     */
    getFocusableItems(): HTMLElement[] {
        const content = (this.el.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="dropdown-content"]');
        if (!content) return [];
        return Array.from(content.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'))
            .filter((item) => item.closest('[role="menu"]') === content);
    }
}
