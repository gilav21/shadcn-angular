import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * The item is the host element itself, carrying `role="listitem"`, rather than an
 * inner `<li>`. Angular always renders the `<ui-sidebar-menu-item>` tag, so an
 * inner `<li>` would sit inside it and no longer be a direct child of the
 * `<ul>` in `ui-sidebar-menu` — breaking both the `list` and `listitem` axe
 * rules (a real WCAG structure failure: the list/item relationship is lost).
 * Naming the host as the list item restores it while keeping the native `<ul>`.
 */
@Component({
  selector: 'ui-sidebar-menu-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    role: 'listitem',
    '[class]': 'classes()',
    '[attr.data-slot]': "'sidebar-menu-item'",
  },
})
export class SidebarMenuItemComponent {
  /** Extra classes merged onto the host, which is the `listitem` inside `ui-sidebar-menu`'s list. Wrap exactly one button or link per item so the list semantics stay intact. */
  class = input('');

  classes = computed(() => cn(
    'list-none',
    this.class()
  ));
}
