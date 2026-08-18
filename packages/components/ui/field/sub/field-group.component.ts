import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * FieldGroup - Groups multiple fields together
 */
@Component({
  selector: 'ui-field-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'field-group'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class FieldGroupComponent {
  /** Extra classes merged onto the group grid, which spaces sibling fields evenly. Purely visual — use `ui-field-set` when the grouping is also semantic. */
  class = input('');

  classes = computed(() => cn(
    'grid gap-4',
    this.class()
  ));
}
