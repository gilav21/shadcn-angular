import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { STEPPER } from '../stepper.component';
import { STEPPER_ITEM } from './stepper-item.component';

@Component({
  selector: 'ui-stepper-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isActive()) {
      <div [class]="classes()" [attr.data-slot]="'stepper-content'">
        <ng-content />
      </div>
    }
  `,
  host: { class: 'contents' },
})
export class StepperContentComponent {
  class = input('');

  readonly stepper = inject(STEPPER, { optional: true });
  readonly item = inject(STEPPER_ITEM, { optional: true });

  isActive = computed(() => this.item?.status() === 'current');

  classes = computed(() =>
    cn(
      'mt-4',
      this.class()
    )
  );
}
