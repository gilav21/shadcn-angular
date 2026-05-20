import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-stepper-description',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()" [attr.data-slot]="'stepper-description'">
      <ng-content />
    </span>
  `,
  host: { class: 'contents' },
})
export class StepperDescriptionComponent {
  class = input('');

  classes = computed(() =>
    cn(
      'text-xs text-muted-foreground',
      this.class()
    )
  );
}
