import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  InjectionToken,
  forwardRef,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { STEPPER, StepStatus } from '../stepper.component';

export const STEPPER_ITEM = new InjectionToken<StepperItemComponent>('STEPPER_ITEM');

@Component({
  selector: 'ui-stepper-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STEPPER_ITEM, useExisting: forwardRef(() => StepperItemComponent) }],
  template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'stepper-item'"
      [attr.data-status]="status()"
      [attr.data-orientation]="stepper?.orientation()"
      role="listitem"
    >
      <ng-content />
    </div>
    @if (!isLast() && stepper?.orientation() === 'horizontal') {
      <div class="flex-1 h-0.5 bg-border mt-4" [class.bg-primary]="status() === 'complete'"></div>
    }
  `,
  host: { class: 'contents' },
})
export class StepperItemComponent {
  class = input('');
  value = input.required<string>();

  readonly stepper = inject(STEPPER, { optional: true });

  index = computed(() => this.stepper?.getStepIndex(this.value()) ?? 0);
  status = computed<StepStatus>(() => this.stepper?.getStepStatus(this.index()) ?? 'pending');
  isLast = computed(() => {
    const items = this.stepper?.items();
    return items ? this.index() === items.length - 1 : true;
  });

  classes = computed(() =>
    cn(
      'flex',
      this.stepper?.orientation() === 'vertical' ? 'flex-row gap-4' : 'flex-col items-center gap-2',
      this.class()
    )
  );
}
