import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
    ElementRef,
    ViewChild,
    booleanAttribute,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { CONTEXT_MENU } from '../context-menu.component';
import { CONTEXT_MENU_SUB, type ContextMenuSubComponent } from './context-menu-sub.component';

@Component({
    selector: 'ui-context-menu-sub-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      #trigger
      [class]="classes()"
      role="menuitem"
      tabindex="0"
      [attr.aria-haspopup]="true"
      [attr.aria-expanded]="sub.isOpen()"
      [attr.data-slot]="'context-menu-sub-trigger'"
      [attr.data-disabled]="disabled() || null"
      [attr.aria-disabled]="disabled() || null"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="sub.leave()"
      (keydown)="onKeydown($event)"
      (click)="$event.stopPropagation()"
    >
      <ng-content />
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" class="h-4 w-4 ltr:ml-auto rtl:mr-auto rtl:rotate-180" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `,
    host: { class: 'contents' },
})
export class ContextMenuSubTriggerComponent {
    /** Extra classes for the inner trigger row, merged after the defaults (the host itself is `display: contents`, so styling the host has no effect). */
    class = input('');
    /**
     * Disables the branch: the value is written to `data-disabled` and
     * `aria-disabled`, so the `data-[disabled]:` styling dims the row and makes
     * it `pointer-events-none`, the row drops out of the arrow-key ring (which
     * walks `[role="menuitem"]:not([data-disabled])`), and neither hover nor
     * the keyboard opens the flyout. Accepts a bare attribute (`disabled`) via
     * `booleanAttribute`.
     */
    disabled = input(false, { transform: booleanAttribute });
    /** Adds `pl-8` (LTR) / `pr-8` (RTL) so the branch label aligns with inset siblings. */
    inset = input(false, { transform: booleanAttribute });

    readonly sub = inject(CONTEXT_MENU_SUB) as ContextMenuSubComponent;
    private readonly contextMenu = inject(CONTEXT_MENU, { optional: true });
    readonly el = inject(ElementRef);

    @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

    constructor() {
        this.sub.registerTrigger(this);
    }

    classes = computed(() => cn(
        'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        this.sub.isOpen() && 'bg-accent text-accent-foreground',
        this.inset() && 'ltr:pl-8 rtl:pr-8',
        this.class()
    ));

    /**
     * Focuses the inner trigger row (`tabindex="0"`, `role="menuitem"`).
     * Called by {@link ContextMenuSubComponent.focusTrigger} when the flyout
     * closes via Escape or the inline-start arrow, so focus returns to the
     * branch rather than being lost with the destroyed portal.
     */
    focus(): void {
        this.triggerEl?.nativeElement.focus();
    }

    /**
     * Opens the flyout on hover, unless {@link disabled}. The matching
     * `mouseleave` closes it after the sub's 100ms grace period, which needs no
     * guard — closing an already-closed flyout is a no-op.
     */
    onMouseEnter(): void {
        if (this.disabled()) return;
        this.sub.enter();
    }

    /**
     * Opens the flyout and moves focus into it on Enter, and on the
     * inline-forward arrow — ArrowRight in LTR, ArrowLeft in RTL (the opposite
     * arrow is left unhandled so it can close a parent flyout). Space does not
     * open the branch. The event is stopped so the parent menu does not act on
     * the same key; the reverse direction is handled by
     * {@link ContextMenuSubContentComponent.onKeydown}. Mouse users get the
     * same result by hovering: `mouseenter` opens immediately, `mouseleave`
     * closes after a 100ms grace period so the pointer can cross the gap. Every
     * key is ignored while {@link disabled}.
     */
    onKeydown(event: KeyboardEvent): void {
        if (this.disabled()) return;
        const rtl = this.contextMenu?.isRtl() ?? false;
        if (event.key === 'ArrowRight') {
            if (rtl) return;
            event.preventDefault();
            event.stopPropagation();
            this.sub.enter();
            this.sub.focusContent();
        }
        if (event.key === 'ArrowLeft') {
            if (rtl) {
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
