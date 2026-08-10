import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-stepper-title',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()" [attr.data-slot]="'stepper-title'">
      <ng-content />
    </span>
  `,
  host: { class: 'contents' },
})
export class StepperTitleComponent {
  /** Extra classes merged onto the title `<span>` (via `cn()`, so utilities here beat the default `text-sm font-medium`). */
  class = input('');

  classes = computed(() =>
    cn(
      'text-sm font-medium',
      this.class()
    )
  );
}
