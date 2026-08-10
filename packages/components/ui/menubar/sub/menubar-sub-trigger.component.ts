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
import { isTouchDevice } from '../../../lib/touch';
import { MenubarService } from '../menubar.component';
import { MENUBAR_SUB, type MenubarSubComponent } from './menubar-sub.component';

@Component({
  selector: 'ui-menubar-sub-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #trigger
      [class]="classes()"
      [attr.data-slot]="'menubar-sub-trigger'"
      role="menuitem"
      [attr.aria-haspopup]="true"
      [attr.aria-expanded]="sub.isOpen()"
      tabindex="0"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (keydown)="onKeydown($event)"
      (click)="onClick()"
    >
      <ng-content />
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 ltr:ml-auto rtl:mr-auto rtl:rotate-180"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `,
  styleUrl: './menubar-sub-trigger.component.css',
  host: { class: 'contents' }
})
export class MenubarSubTriggerComponent {
  /** Extra classes merged onto the trigger row, after the hover/focus/open-state classes. */
  class = input('');
  /**
   * Intended to disable the sub-trigger, but currently has no effect: the value
   * is never bound to `data-disabled` and never checked in
   * {@link onClick} / {@link onMouseEnter} / {@link onKeydown}, so a "disabled"
   * sub-trigger still opens its submenu, is not dimmed, and stays in the
   * arrow-key ring. Unlike `ui-menubar-item`'s `disabled`, which does all three.
   */
  disabled = input(false, { transform: booleanAttribute });
  /**
   * Indents the label by 2rem (direction-aware) so the trigger lines up with
   * inset `ui-menubar-item`s in the same menu.
   */
  inset = input(false, { transform: booleanAttribute });

  readonly sub = inject(MENUBAR_SUB) as MenubarSubComponent;
  readonly service = inject(MenubarService);
  readonly el = inject(ElementRef);

  @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

  constructor() {
    this.sub.registerTrigger(this);
  }

  classes = computed(() => cn(
    'relative flex cursor-pointer select-none items-center rounded-sm text-sm outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    this.sub.isOpen() && 'bg-accent text-accent-foreground',
    this.inset() && 'ltr:pl-8 rtl:pr-8',
    this.class()
  ));

  /**
   * Opens the submenu immediately on hover — there is no open delay, only a
   * close delay. No-op on touch devices, where {@link onClick} drives the
   * submenu instead.
   */
  onMouseEnter(): void {
    if (isTouchDevice()) return;
    this.sub.enter();
  }

  /**
   * Starts the submenu's 100ms close timer when the pointer leaves the trigger,
   * giving the user time to reach the panel (which cancels it by calling
   * `enter()` on its own mouseenter). No-op on touch devices.
   */
  onMouseLeave(): void {
    if (isTouchDevice()) return;
    this.sub.leave();
  }

  /**
   * Touch-only toggle: on a touch device a tap opens or closes the submenu,
   * closing it through the same 100ms-delayed path as hover. Ignored entirely
   * with a mouse, where hover already drives the submenu.
   */
  onClick(): void {
    if (!isTouchDevice()) return;
    if (this.sub.isOpen()) {
      this.sub.leave();
    } else {
      this.sub.enter();
    }
  }

  /** Focuses the trigger row. Called when the submenu is closed with the back arrow key so focus does not fall to the document. */
  focus(): void {
    this.triggerEl?.nativeElement.focus();
  }

  /**
   * Enter, or the "forward" arrow (ArrowRight under LTR, ArrowLeft under RTL),
   * opens the submenu and moves focus to its first item; propagation is stopped
   * so the parent menu does not also act on the arrow. Every other key is left
   * to bubble — ArrowUp/ArrowDown are handled by the parent
   * `ui-menubar-content`, which walks the trigger together with the rest of the
   * items.
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      if (this.service.isRtl()) {
        return;
      }
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
