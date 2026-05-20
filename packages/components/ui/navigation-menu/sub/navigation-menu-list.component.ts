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
  class = input('');

  classes = computed(() => cn(
    'group flex flex-1 list-none items-center justify-center space-x-1 overflow-x-auto scrollbar-hide',
    this.class()
  ));
}
