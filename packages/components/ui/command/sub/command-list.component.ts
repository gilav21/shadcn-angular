import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { CommandService } from '../command.component';

@Component({
  selector: 'ui-command-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'command-list'" [attr.role]="role()" [attr.aria-label]="role() ? ariaLabel() : null">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class CommandListComponent {
  private readonly cmdService = inject(CommandService);

  /**
   * `role="listbox"` is only claimed while the list actually holds options.
   *
   * `aria-required-children` is a *critical* violation, and the role is
   * advertised on the scroll container regardless of what is inside it — so an
   * empty result set, or an async source still showing "Searching…", left a
   * listbox with no `option` children. Dropping the role in that state is the
   * accurate description: there is no list to browse yet.
   */
  protected readonly role = computed(() =>
    this.cmdService.filteredItemIds().size > 0 ? 'listbox' : null
  );

  /** Merged onto the scroll container; override the default `max-h-[200px] sm:max-h-[300px]` here to change how tall the results area grows before it scrolls. */
  class = input('');
  /** Accessible name for the `role="listbox"` wrapper. Unset leaves it unnamed, so provide one whenever the list has no visible label near it. */
  ariaLabel = input<string | undefined>(undefined);

  classes = computed(() => cn(
    'max-h-[200px] sm:max-h-[300px] overflow-y-auto overflow-x-hidden',
    this.class()
  ));
}
