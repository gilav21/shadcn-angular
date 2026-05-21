import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CommandService } from '../command.component';

@Component({
  selector: 'ui-command-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
      @if (isVisible()) {
        <div class="py-6 text-center text-sm text-muted-foreground" [attr.data-slot]="'command-empty'">
            <ng-content />
        </div>
      }
  `,
  host: { class: 'contents' },
})
export class CommandEmptyComponent {
  readonly cmdService = inject(CommandService);

  isVisible = computed(() => {
    return this.cmdService.filteredItemIds().size === 0;
  });
}
