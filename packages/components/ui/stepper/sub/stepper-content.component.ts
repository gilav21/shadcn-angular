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
  /** Extra classes merged onto the content panel wrapper (via `cn()`, so utilities here override the default `mt-4` spacing). Only applied while the panel is rendered — the panel is removed from the DOM unless its {@link StepperItemComponent} is the current step. */
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
