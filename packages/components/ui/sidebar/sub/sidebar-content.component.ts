import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ScrollAreaComponent } from '../../scroll-area';

@Component({
  selector: 'ui-sidebar-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollAreaComponent],
  template: `
    <ui-scroll-area [class]="classes()" [attr.data-slot]="'sidebar-content'">
      <ng-content />
    </ui-scroll-area>
  `,
  host: { class: 'contents' },
})
export class SidebarContentComponent {
  class = input('');

  classes = computed(() => cn(
    'flex-1 py-2',
    this.class()
  ));
}
