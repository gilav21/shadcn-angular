import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SidebarService } from '../sidebar.service';
import { SidebarMenuSubComponent } from './sidebar-menu-sub.component';

/**
 * The row that opens and closes a {@link SidebarMenuSubComponent}.
 *
 * It is a plain `<button>` rather than a heading + `role="menuitem"`: the
 * sidebar's menu is a real `<ul>` of `listitem`s, and a heading or menu role
 * here would break the list relationship that `ui-sidebar-menu-item` exists to
 * protect. `aria-expanded` and `aria-controls` carry the state instead, which
 * is what a disclosure button needs.
 *
 * Place it and its sub list inside the same `ui-sidebar-menu-item`:
 *
 * ```html
 * <ui-sidebar-menu-item>
 *   <ui-sidebar-menu-sub-trigger [sub]="projects">Projects</ui-sidebar-menu-sub-trigger>
 *   <ui-sidebar-menu-sub #projects>…</ui-sidebar-menu-sub>
 * </ui-sidebar-menu-item>
 * ```
 */
@Component({
  selector: 'ui-sidebar-menu-sub-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'sidebar-menu-sub-trigger'"
      [attr.data-state]="isOpen() ? 'open' : 'closed'"
      [attr.data-collapsed]="isCollapsedState()"
      [attr.aria-expanded]="isOpen()"
      [attr.aria-controls]="sub()?.id() ?? null"
      (click)="toggle()"
    >
      <ng-content />
      <svg
        class="ms-auto size-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-300 motion-reduce:transition-none"
        [class.rotate-90]="isOpen()"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuSubTriggerComponent {
  /** Extra classes merged onto the `<button>`. */
  readonly class = input('');
  /**
   * The list this row controls, as a template reference
   * (`[sub]="projects"` with `<ui-sidebar-menu-sub #projects>`). Required for
   * the toggle and for `aria-controls` to point anywhere.
   */
  readonly sub = input<SidebarMenuSubComponent | undefined>(undefined);

  private readonly service = inject(SidebarService);

  readonly isOpen = computed(() => this.sub()?.isOpen() ?? false);
  readonly isCollapsedState = computed(
    () => this.service.isCollapsed() && !this.service.isMobile()
  );

  /** Flips the controlled list. A no-op when no list is bound. */
  toggle(): void {
    this.sub()?.toggle();
  }

  readonly classes = computed(() =>
    cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm',
      'text-sidebar-foreground',
      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'transition-colors',
      // Matches ui-sidebar-menu-button's collapsed presentation: icon only.
      this.isCollapsedState() &&
        'justify-center px-2 overflow-hidden [&>span:not(:first-child)]:sr-only [&>svg:last-child]:hidden',
      this.class()
    )
  );
}
