import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * FieldSeparator - Visual separator between fields
 */
@Component({
  selector: 'ui-field-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hr [class]="classes()" [attr.data-slot]="'field-separator'" />
  `,
  host: { class: 'contents' },
})
export class FieldSeparatorComponent {
  class = input('');

  classes = computed(() => cn(
    'my-4 border-t border-border',
    this.class()
  ));
}
