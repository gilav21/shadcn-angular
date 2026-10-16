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
  selector: 'ui-command-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
      @if (isVisible()) {
        <div [class]="classes()" [attr.data-slot]="'command-empty'">
            <ng-content />
        </div>
      }
  `,
  host: { class: 'contents' },
})
export class CommandEmptyComponent {
  readonly cmdService = inject(CommandService);

  /** Extra classes merged onto the empty-state message, after the centred muted default. */
  readonly class = input('');
  readonly classes = computed(() => cn('py-6 text-center text-sm text-muted-foreground', this.class()));

  isVisible = computed(() => {
    return this.cmdService.filteredItemIds().size === 0;
  });
}
