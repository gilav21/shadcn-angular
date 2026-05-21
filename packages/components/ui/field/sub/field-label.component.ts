import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * FieldLabel - Label for a field
 */
@Component({
  selector: 'ui-field-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      [class]="classes()"
      [attr.data-slot]="'field-label'"
      [attr.for]="for()"
    >
      <ng-content />
    </label>
  `,
  host: { class: 'contents' },
})
export class FieldLabelComponent {
  class = input('');
  for = input('');

  classes = computed(() => cn(
    'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    this.class()
  ));
}
