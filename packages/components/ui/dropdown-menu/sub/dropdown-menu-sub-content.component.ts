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
    class = input('');
    readonly sub = inject(DropdownMenuSubComponent);
    readonly service = inject(DropdownMenuService);
    readonly el = inject(ElementRef);

    constructor() {
        this.sub.registerContent(this);
    }

    onMouseEnter() {
        if (isTouchDevice()) return;
        this.sub.enter();
    }

    onMouseLeave() {
        if (isTouchDevice()) return;
        this.sub.leave();
    }

    classes = computed(() => cn(
        'absolute top-0 z-50 min-w-[8rem] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'ltr:left-full ltr:ml-1 ltr:animate-in ltr:slide-in-from-left-1 ltr:fade-in-0 ltr:zoom-in-95',
        'rtl:right-full rtl:mr-1 rtl:animate-in rtl:slide-in-from-right-1 rtl:fade-in-0 rtl:zoom-in-95',
        this.class()
    ));

    focusFirst() {
        const items = Array.from((this.el.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        items[0]?.focus();
    }

    onKeydown(event: KeyboardEvent) {
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

    focusNextItem(currentItem: HTMLElement) {
        const div = currentItem.closest<HTMLElement>('[role="menu"]') || currentItem;
        const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        const index = items.indexOf(currentItem);
        const nextIndex = (index + 1) % items.length;
        items[nextIndex]?.focus();
    }

    focusPrevItem(currentItem: HTMLElement) {
        const div = currentItem.closest<HTMLElement>('[role="menu"]') || currentItem;
        const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        const index = items.indexOf(currentItem);
        const prevIndex = (index - 1 + items.length) % items.length;
        items[prevIndex]?.focus();
    }
}
