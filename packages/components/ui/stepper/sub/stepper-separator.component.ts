import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  forwardRef,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { STEPPER } from '../stepper.component';
import { STEPPER_ITEM, STEPPER_SEPARATOR } from './stepper-item.component';
import { stepperConnectorClasses } from '../stepper.utils';

@Component({
  selector: 'ui-stepper-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STEPPER_SEPARATOR, useExisting: forwardRef(() => StepperSeparatorComponent) }],
  template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'stepper-separator'"
      [attr.data-complete]="isComplete() || null"
    ></div>
  `,
  host: { class: 'contents' },
})
export class StepperSeparatorComponent {
  /** Extra classes merged onto the separator bar (via `cn()`, so utilities here override the orientation-derived size and the `bg-primary`/`bg-border` colour that tracks the owning item's completion). */
  class = input('');

  readonly stepper = inject(STEPPER, { optional: true });
  readonly item = inject(STEPPER_ITEM, { optional: true });

  isComplete = computed(() => this.item?.status() === 'complete');

  classes = computed(() =>
    cn(
      stepperConnectorClasses(
        this.stepper?.orientation() === 'horizontal' ? 'horizontal' : 'vertical',
        this.isComplete(),
        'w-full',
      ),
      this.class()
    )
  );
}
