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
  /** Extra classes merged onto the `<label>`. The built-in `peer-disabled:*` rules only apply when the control is a preceding sibling marked `peer`. */
  class = input('');
  /** `id` of the control this labels, forwarded to the native `for` attribute so clicking the text focuses it. The field does not wire this automatically — set the same id on your input. */
  for = input('');

  classes = computed(() => cn(
    'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    this.class()
  ));
}
