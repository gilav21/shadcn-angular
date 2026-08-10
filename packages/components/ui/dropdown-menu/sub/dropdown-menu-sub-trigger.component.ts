import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    input,
    ViewChild,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { isTouchDevice } from '../../../lib/touch';
import { DropdownMenuService } from '../dropdown-menu.component';
import { DropdownMenuSubComponent } from './dropdown-menu-sub.component';

@Component({
    selector: 'ui-dropdown-menu-sub-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      #trigger
      [class]="classes()"
      role="menuitem"
      tabindex="0"
      [attr.aria-haspopup]="true"
      [attr.aria-expanded]="sub.isOpen()"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (keydown)="onKeydown($event)"
      (click)="onClick()"
    >
      <ng-content />
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" class="h-4 w-4 ltr:ml-auto rtl:mr-auto rtl:rotate-180" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `,
    host: { class: 'contents' }
})
export class DropdownMenuSubTriggerComponent {
    /** Extra classes merged onto the trigger row, after the defaults so they can override them. */
    class = input('');
    /**
     * Intended to dim and neutralise the row. Note it only feeds the
     * `data-[disabled]:` classes — the element never gets a `data-disabled`
     * attribute, so today it neither dims the row nor blocks opening the
     * submenu.
     */
    disabled = input(false, { transform: booleanAttribute });
    /**
     * Adds leading indentation so the label aligns with sibling items that
     * carry an icon or checkmark.
     */
    inset = input(false, { transform: booleanAttribute });

    readonly sub = inject(DropdownMenuSubComponent);
    readonly service = inject(DropdownMenuService);
    readonly el = inject(ElementRef);

    @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

    constructor() {
        this.sub.registerTrigger(this);
    }

    classes = computed(() => cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        this.sub.isOpen() && 'bg-accent text-accent-foreground',
        this.inset() && 'ltr:pl-8 rtl:pr-8',
        this.class()
    ));

    /** Opens the submenu on hover, cancelling any pending close. Skipped on touch devices, which use {@link onClick}. */
    onMouseEnter(): void {
        if (isTouchDevice()) return;
        this.sub.enter();
    }

    /**
     * Starts the grace-period close when the pointer leaves; moving onto the
     * submenu panel cancels it. Skipped on touch devices.
     */
    onMouseLeave(): void {
        if (isTouchDevice()) return;
        this.sub.leave();
    }

    /**
     * Tap-to-toggle for touch devices, where hover never fires. Deliberately a
     * no-op with a mouse, so a click does not immediately close a submenu hover
     * has just opened.
     */
    onClick(): void {
        if (!isTouchDevice()) return;
        if (this.sub.isOpen()) {
            this.sub.leave();
        } else {
            this.sub.enter();
        }
    }

    /**
     * Focuses the inner `role="menuitem"` row (not the `contents` host).
     * Invoked by the parent `<ui-dropdown-menu-sub>` when the submenu closes
     * from the keyboard.
     */
    focus(): void {
        this.triggerEl?.nativeElement.focus();
    }

    /**
     * Opens the submenu and moves focus into it on Enter or the "forward" arrow
     * (ArrowRight, or ArrowLeft in RTL). Propagation is stopped for the arrows
     * so the root menu does not treat them as its own navigation.
     */
    onKeydown(event: KeyboardEvent): void {
        if (event.key === 'ArrowRight') {
            if (this.service.isRtl()) return;
            event.preventDefault();
            event.stopPropagation();
            this.sub.enter();
            this.sub.focusContent();
        }
        if (event.key === 'ArrowLeft') {
            if (this.service.isRtl()) {
                event.preventDefault();
                event.stopPropagation();
                this.sub.enter();
                this.sub.focusContent();
            }
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            this.sub.enter();
            this.sub.focusContent();
        }
    }
}
