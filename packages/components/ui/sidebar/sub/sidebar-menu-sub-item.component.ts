import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * A row inside {@link SidebarMenuSubComponent}. Like
 * {@link SidebarMenuItemComponent} the host itself is the `listitem`, so the
 * nested `<ul>`'s direct children stay list items and the list/listitem
 * relationship screen readers rely on is preserved.
 */
@Component({
  selector: 'ui-sidebar-menu-sub-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    role: 'listitem',
    '[class]': 'classes()',
    '[attr.data-slot]': "'sidebar-menu-sub-item'",
  },
})
export class SidebarMenuSubItemComponent {
  /** Extra classes merged onto the host. Wrap exactly one sub-button per item so the list semantics stay intact. */
  readonly class = input('');

  // `relative` positions ui-sidebar-menu-action against the row; see
  // SidebarMenuItemComponent.
  readonly classes = computed(() => cn('relative list-none', this.class()));
}
