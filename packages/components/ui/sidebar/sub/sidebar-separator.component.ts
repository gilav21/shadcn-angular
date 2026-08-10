import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-sidebar-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hr [class]="classes()" [attr.data-slot]="'sidebar-separator'" />
  `,
  host: { class: 'contents' },
})
export class SidebarSeparatorComponent {
  /** Extra classes merged onto the `<hr>`. Uses a real rule rather than a styled div, so it is exposed as a separator without any ARIA. */
  class = input('');

  classes = computed(() => cn(
    'mx-2 my-2 border-t border-sidebar-border',
    this.class()
  ));
}
