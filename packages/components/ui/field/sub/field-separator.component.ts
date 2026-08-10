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
  /** Extra classes merged onto the `<hr>`. It ships its own vertical margin, so override `my-4` rather than adding padding around it. */
  class = input('');

  classes = computed(() => cn(
    'my-4 border-t border-border',
    this.class()
  ));
}
