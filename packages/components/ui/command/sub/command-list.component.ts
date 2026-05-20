import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-command-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'command-list'" role="listbox" [attr.aria-label]="ariaLabel()">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class CommandListComponent {
  class = input('');
  ariaLabel = input<string | undefined>(undefined);

  classes = computed(() => cn(
    'max-h-[200px] sm:max-h-[300px] overflow-y-auto overflow-x-hidden',
    this.class()
  ));
}
