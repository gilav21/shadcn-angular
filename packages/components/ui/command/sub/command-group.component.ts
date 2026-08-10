import {
  ChangeDetectionStrategy,
  Component,
  computed,
  InjectionToken,
  inject,
  input,
  forwardRef,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { CommandService, generateId } from '../command.component';

export const COMMAND_GROUP = new InjectionToken<CommandGroupComponent>('COMMAND_GROUP');

@Component({
  selector: 'ui-command-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: COMMAND_GROUP, useExisting: forwardRef(() => CommandGroupComponent) },
  ],
  template: `
    <div
        [class]="classes()"
        [attr.data-slot]="'command-group'"
        role="group"
        [class.hidden]="!isVisible()"
    >
      @if (heading()) {
        <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {{ heading() }}
        </div>
      }
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class CommandGroupComponent {
  /** Section label rendered above the items; omit it and no heading row is emitted at all. It is not matched against the search query — only item values are. */
  heading = input('');
  /** Merged onto the group wrapper. Note the group hides itself (via `hidden`) whenever every one of its items is filtered out, so display utilities here can be overridden. */
  class = input('');

  readonly id = generateId();
  readonly cmdService = inject(CommandService);

  classes = computed(() => cn(
    'overflow-hidden p-1 text-foreground',
    this.class()
  ));

  isVisible = computed(() => {
    return this.cmdService.visibleGroupIds().has(this.id);
  });
}
