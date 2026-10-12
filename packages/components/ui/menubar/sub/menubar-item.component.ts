import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
  booleanAttribute,
} from '@angular/core';
import { activateAsClick } from '../../../lib/menu-activation';
import { cn } from '../../../lib/utils';
import { MENUBAR_MENU, type MenubarMenuComponent } from './menubar-menu.component';

@Component({
  selector: 'ui-menubar-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #row
      [class]="classes()"
      [attr.data-slot]="'menubar-item'"
      [attr.data-disabled]="disabled() || null"
      [attr.aria-disabled]="disabled() || null"
      role="menuitem"
      tabindex="-1"
      (click)="onClick($event)"
      (keydown.enter)="activate($event, row)"
      (keydown.space)="activate($event, row)"
    >
      <ng-content />
      @if (shortcut()) {
        <span class="ms-auto text-xs tracking-widest text-muted-foreground">{{ shortcut() }}</span>
      }
    </div>
  `,
  styleUrl: './menubar-item.component.css',
  host: { class: 'contents' },
})
export class MenubarItemComponent {
  /** Extra classes merged onto the item row, after the hover/focus/disabled state classes. */
  class = input('');
  /**
   * Greys the item to 50% opacity, sets `pointer-events-none` so clicks pass
   * through, exposes `aria-disabled="true"`, suppresses {@link selected} and
   * keeps a click made any other way (assistive technology, a programmatic
   * `.click()`) from reaching a `(click)` bound on the item, and — via the
   * `data-disabled` attribute — removes the item from the menu's arrow-key ring entirely
   * (see `MenubarContentComponent.getFocusableItems`). The item is not
   * reachable with Tab either: every menu item carries `tabindex="-1"` per the
   * WAI-ARIA menu pattern, so Tab leaves the menu rather than walking it.
   */
  disabled = input(false, { transform: booleanAttribute });
  /**
   * Indents the label by 2rem (direction-aware) so items without an icon or
   * checkmark line up with the ones that have one.
   */
  inset = input(false, { transform: booleanAttribute });
  /**
   * Hint text rendered right-aligned in muted type (e.g. `⌘T`). Purely a label —
   * no key handler is registered, so the shortcut must be wired up by the app.
   */
  shortcut = input('');

  /**
   * Fires when the item is activated by click, Enter or Space, just before the
   * menu is closed. Never fires while {@link disabled}.
   */
  selected = output<void>();
  readonly menu = inject(MENUBAR_MENU, { optional: true }) as MenubarMenuComponent | null;

  classes = computed(() => cn(
    'relative flex cursor-pointer select-none items-center rounded-sm text-sm outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    this.inset() && 'ltr:pl-8 rtl:pr-8',
    this.class()
  ));

  /**
   * Activation handler for click, Enter and Space alike (the keys dispatch a
   * click on the row): emits {@link selected} and then closes the owning menu,
   * which also tears down any open submenu. The click goes on to bubble to the
   * `<ui-menubar-item>` host, so a `(click)` you bind there runs too, once.
   * While {@link disabled} it does nothing and — given the click `event` —
   * stops it here, so that `(click)` never sees it however the click was made.
   * Items used outside a `ui-menubar-menu` still emit but have no menu to close.
   */
  onClick(event?: Event): void {
    if (this.disabled()) {
      event?.stopPropagation();
      return;
    }
    this.selected.emit();
    this.menu?.closeAfterActivation();
  }

  /** Enter or Space on the row: one click, and the page behind the menu does not scroll. Nothing happens while {@link disabled}. */
  activate(event: Event, row: HTMLElement): void {
    activateAsClick(event, row, this.disabled());
  }
}
