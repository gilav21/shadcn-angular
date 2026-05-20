import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-sidebar-inset',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main [class]="classes()" [attr.data-slot]="'sidebar-inset'">
      <ng-content />
    </main>
  `,
  host: {
    '[class]': '"flex flex-1 flex-col min-w-0 max-h-screen " + class()',
  },
})
export class SidebarInsetComponent {
  class = input('');

  classes = computed(() => cn(
    'flex flex-1 flex-col overflow-hidden',
    this.class()
  ));
}
