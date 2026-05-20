import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { TooltipDirective } from '../../tooltip';
import { SidebarService } from '../sidebar.component';

@Component({
  selector: 'ui-sidebar-menu-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'sidebar-menu-button'"
      [attr.data-active]="isActive()"
      [attr.data-collapsed]="isCollapsedState()"
      (click)="onClick.emit($event)"
      [uiTooltip]="tooltip()"
      tooltipSide="right"
      [tooltipDisabled]="!isCollapsedState() || !tooltip()"
    >
      <ng-content />
    </button>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuButtonComponent {
  class = input('');
  isActive = input(false);
  tooltip = input('');
  onClick = output<MouseEvent>();
  readonly service = inject(SidebarService);

  isCollapsedState = computed(() => this.service.isCollapsed() && !this.service.isMobile());

  classes = computed(() => {
    const isCollapsed = this.isCollapsedState();

    return cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm',
      'text-sidebar-foreground',
      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'transition-colors',
      this.isActive() && 'bg-sidebar-accent text-sidebar-accent-foreground',
      isCollapsed && 'justify-center px-2 overflow-hidden [&>span:not(:first-child)]:hidden [&>svg]:shrink-0',
      this.class()
    );
  });
}
