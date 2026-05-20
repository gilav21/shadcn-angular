import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SidebarService } from '../sidebar.service';

@Component({
  selector: 'ui-sidebar-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'sidebar-trigger'"
      [attr.aria-expanded]="service.isOpen()"
      aria-label="Toggle sidebar"
      (click)="service.toggle()"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <line x1="9" x2="9" y1="3" y2="21"/>
      </svg>
      <span class="sr-only">Toggle Sidebar</span>
    </button>
  `,
  host: { class: 'contents' },
})
export class SidebarTriggerComponent {
  class = input('');
  readonly service = inject(SidebarService);

  classes = computed(() => cn(
    'inline-flex h-8 w-8 items-center justify-center rounded-md',
    'text-sidebar-foreground',
    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    this.class()
  ));
}
