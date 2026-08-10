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
  /** Extra classes merged onto the scroll area. This is the flex-1 middle region between header and footer, so it is the part that scrolls when the nav outgrows the viewport — keep it as the sidebar's only scrolling child. */
  class = input('');

  classes = computed(() => cn(
    'flex-1 py-2',
    this.class()
  ));
}
