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
  class = input('');
  disabled = input(false, { transform: booleanAttribute });
  inset = input(false, { transform: booleanAttribute });
  shortcut = input('');

  select = output<void>();
  readonly menu = inject(MENUBAR_MENU, { optional: true }) as MenubarMenuComponent | null;

  classes = computed(() => cn(
    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    this.inset() && 'ltr:pl-8 rtl:pr-8',
    this.class()
  ));

  onClick() {
    if (!this.disabled()) {
      this.select.emit();
      this.menu?.close();
    }
  }
}
