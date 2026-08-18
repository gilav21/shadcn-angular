import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * FieldLegend - Legend for a fieldset
 */
@Component({
  selector: 'ui-field-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <legend [class]="classes()" [attr.data-slot]="'field-legend'">
      <ng-content />
    </legend>
  `,
  host: { class: 'contents' },
})
export class FieldLegendComponent {
  /** Extra classes merged onto the native `<legend>`. Only meaningful as the first child of `ui-field-set`, where it names the group for assistive tech. */
  class = input('');

  classes = computed(() => cn(
    'text-sm font-medium leading-none',
    this.class()
  ));
}
