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
  /** Merged onto the scroll container; override the default `max-h-[200px] sm:max-h-[300px]` here to change how tall the results area grows before it scrolls. */
  class = input('');
  /** Accessible name for the `role="listbox"` wrapper. Unset leaves it unnamed, so provide one whenever the list has no visible label near it. */
  ariaLabel = input<string | undefined>(undefined);

  classes = computed(() => cn(
    'max-h-[200px] sm:max-h-[300px] overflow-y-auto overflow-x-hidden',
    this.class()
  ));
}
