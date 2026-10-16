import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-command-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'command-separator'"></div>
  `,
  host: { class: 'contents' },
})
export class CommandSeparatorComponent {
  /** Extra classes merged onto the rule, after `-mx-1 h-px bg-border`. */
  readonly class = input('');

  readonly classes = computed(() => cn('-mx-1 h-px bg-border', this.class()));
}
