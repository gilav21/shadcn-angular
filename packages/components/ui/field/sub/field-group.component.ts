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
  class = input('');

  classes = computed(() => cn(
    'grid gap-4',
    this.class()
  ));
}
