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
  selector: 'ui-stepper-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      'transition-colors',
      this.stepper?.orientation() === 'horizontal'
        ? 'mx-2 h-0.5 w-full'
        : 'ms-4 mt-2 mb-2 w-0.5 h-8',
      this.isComplete() ? 'bg-primary' : 'bg-border',
      this.class()
    )
  );
}
