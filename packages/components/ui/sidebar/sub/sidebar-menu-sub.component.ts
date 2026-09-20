import {
  Component,
  ChangeDetectionStrategy,
  input,
  model,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SidebarService } from '../sidebar.service';

let nextId = 0;

/**
 * Nested menu list, rendered as a `<ul>` inside a {@link SidebarMenuItemComponent}
 * alongside the row that toggles it.
 *
 * The list is **always rendered** and hidden by collapsing a CSS grid row from
 * `1fr` to `0fr`, which is what makes closing animate — a `@if` would destroy
 * the subtree and the collapse would just pop. Closed content is `inert`, so it
 * leaves the tab order and the accessibility tree entirely and Tab reaches only
 * the rows a sighted user can see. That is the whole keyboard story here: the
 * sidebar is a navigation list, not an ARIA menu widget, so there is no
 * roving focus and no arrow-key handling to get wrong.
 */
@Component({
  selector: 'ui-sidebar-menu-sub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="wrapperClasses()"
      [attr.id]="id()"
      [attr.data-slot]="'sidebar-menu-sub'"
      [attr.data-state]="isOpen() ? 'open' : 'closed'"
    >
      <div class="overflow-hidden">
        <ul [class]="classes()" [attr.inert]="isOpen() ? null : ''">
          <ng-content />
        </ul>
      </div>
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuSubComponent {
  /** Extra classes merged onto the nested `<ul>`. */
  readonly class = input('');
  /**
   * Whether the nested list is open. Two-way (`[(expanded)]`), so bind it to
   * drive the list from your own state, pass it one-way to pin it, or leave it
   * alone and let the trigger manage it. Defaults to **open** — a nav tree that
   * hides its children until clicked makes them undiscoverable.
   */
  readonly expanded = model(true);
  /**
   * DOM id, used as the trigger's `aria-controls` target. Defaults to a
   * generated unique value; override it only with something unique in the
   * document.
   */
  readonly id = input(`sidebar-menu-sub-${nextId++}`);

  private readonly service = inject(SidebarService);

  /**
   * A 60px rail has no room for nested rows, so a collapsed desktop sidebar
   * forces the list shut whatever {@link expanded} says. The input itself is
   * left untouched, so expanding the rail again restores what the user had
   * open rather than resetting it.
   */
  readonly isOpen = computed(
    () => this.expanded() && !(this.service.isCollapsed() && !this.service.isMobile())
  );

  /** Flips {@link expanded}; the trigger row calls this. */
  toggle(): void {
    this.expanded.update(open => !open);
  }

  readonly wrapperClasses = computed(() =>
    cn(
      'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
      this.isOpen() ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
    )
  );

  readonly classes = computed(() =>
    cn(
      // ps-* + the border draw the indent guide; both are logical, so RTL mirrors.
      'flex min-w-0 flex-col gap-1 ps-4 ms-3.5 border-s border-sidebar-border',
      'transition-opacity duration-200 motion-reduce:transition-none',
      this.isOpen() ? 'opacity-100' : 'opacity-0',
      this.class()
    )
  );
}
