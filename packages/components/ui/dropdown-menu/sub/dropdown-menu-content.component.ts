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
    class = input('');
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

    focusFirstItem() {
        const item = (this.el.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])');
        item?.focus();
    }

    onKeydown(event: KeyboardEvent) {
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
            const lastItem = items.at(-1)!;
            const activeElement = this.document.activeElement as HTMLElement;

            if (event.shiftKey) {
                if (activeElement === firstItem) {
                    lastItem.focus();
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

    focusNextItem(currentItem: HTMLElement) {
        const items = this.getFocusableItems();
        const index = items.indexOf(currentItem);
        const nextIndex = (index + 1) % items.length;
        items[nextIndex]?.focus();
    }

    focusPrevItem(currentItem: HTMLElement) {
        const items = this.getFocusableItems();
        const index = items.indexOf(currentItem);
        const prevIndex = (index - 1 + items.length) % items.length;
        items[prevIndex]?.focus();
    }

    getFocusableItems(): HTMLElement[] {
        return Array.from((this.el.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
    }
}
