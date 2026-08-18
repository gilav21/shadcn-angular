import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-navigation-menu-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul [class]="classes()" [attr.data-slot]="'navigation-menu-list'" role="menubar">
      <ng-content />
    </ul>
  `,
  host: { class: 'contents' },
})
export class NavigationMenuListComponent {
  /**
   * Extra classes merged onto the `<ul>`. The base classes lay the items out as a centered,
   * `flex-wrap` row with `gap-1` and no list markers, and add the `group` marker other slots can
   * target. Do not add an `overflow-*` class: any non-visible overflow on one axis forces the
   * other to `auto`, turning the list into a scroll container that clips the dropdowns hanging
   * below it — narrow viewports are meant to wrap, not scroll.
   */
  class = input('');

  // No `overflow-x-auto` here: setting one overflow axis to a non-visible value
  // forces the other to `auto`, which turns this <ul> into a scroll container
  // and clips the dropdown content that hangs below it — the menu would render
  // nothing but its triggers. Narrow viewports wrap instead of scrolling.
  classes = computed(() => cn(
    'group flex flex-1 flex-wrap list-none items-center justify-center gap-1',
    this.class()
  ));
}
