import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
  booleanAttribute,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { MENUBAR_MENU, type MenubarMenuComponent } from './menubar-menu.component';

@Component({
  selector: 'ui-menubar-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'menubar-item'"
      [attr.data-disabled]="disabled() || null"
      role="menuitem"
      tabindex="0"
      (click)="onClick()"
      (keydown.enter)="onClick()"
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
   * through, suppresses {@link selected}, and — via the `data-disabled`
   * attribute — removes the item from the menu's arrow-key ring entirely
   * (see `MenubarContentComponent.getFocusableItems`). The item keeps
   * `tabindex="0"`, so it is still reachable with Tab.
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
   * Fires when the item is activated by click or Enter, just before the menu is
   * closed. Never fires while {@link disabled}.
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
   * Activation handler for both click and Enter: emits {@link selected} and then
   * closes the owning menu, which also tears down any open submenu. Does nothing
   * when {@link disabled}. Items used outside a `ui-menubar-menu` still emit but
   * have no menu to close.
   */
  onClick(): void {
    if (!this.disabled()) {
      this.selected.emit();
      this.menu?.close();
    }
  }
}
