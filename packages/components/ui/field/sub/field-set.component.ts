import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * FieldSet - Semantic fieldset for related fields
 */
@Component({
  selector: 'ui-field-set',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset [class]="classes()" [attr.data-slot]="'field-set'">
      <ng-content />
    </fieldset>
  `,
  host: { class: 'contents' },
})
export class FieldSetComponent {
  /** Extra classes merged onto the native `<fieldset>`. The browser's default border and padding are stripped and replaced with a grid, so it groups semantically without looking boxed. */
  class = input('');

  classes = computed(() => cn(
    'grid gap-4 border-none p-0',
    this.class()
  ));
}
