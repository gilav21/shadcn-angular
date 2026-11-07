import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  InjectionToken,
  forwardRef,
  contentChild,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { STEPPER, StepStatus } from '../stepper.component';
import { stepperConnectorClasses } from '../stepper.utils';

export const STEPPER_ITEM = new InjectionToken<StepperItemComponent>('STEPPER_ITEM');
/** Provided by `ui-stepper-separator` so the item can detect one without importing it (the separator already imports the item). */
export const STEPPER_SEPARATOR = new InjectionToken<unknown>('STEPPER_SEPARATOR');

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
    >
      <ng-content />
    </div>
    @if (showConnector()) {
      <div [class]="connectorClasses()" [attr.data-slot]="'stepper-connector'"></div>
    }
  `,
  // The parent `<ol data-slot="stepper">` may only contain list items. This host is
  // its direct child, so it must carry the listitem role or the list is malformed
  // (axe `list`).
  host: { class: 'contents', role: 'listitem' },
})
export class StepperItemComponent {
  /** Extra classes merged onto the item's inner wrapper (via `cn()`, so utilities here override the orientation-derived flex direction and gap). Does not reach the trailing connector, which is a sibling of that wrapper. */
  class = input('');
  /** Stable identifier for this step. Its position among the parent's projected items is what determines the step number and status, so it must be unique within one stepper — {@link StepperComponent.getStepIndex} matches on it. */
  value = input.required<string>();

  readonly stepper = inject(STEPPER, { optional: true });

  index = computed(() => this.stepper?.getStepIndex(this.value()) ?? 0);
  status = computed<StepStatus>(() => this.stepper?.getStepStatus(this.index()) ?? 'pending');
  isLast = computed(() => {
    const items = this.stepper?.items();
    return items ? this.index() === items.length - 1 : true;
  });

  private readonly projectedSeparator = contentChild(STEPPER_SEPARATOR);

  /** A projected `ui-stepper-separator` is the consumer drawing the line themselves, so the auto connector steps aside: one bar per gap in every mode. */
  readonly showConnector = computed(() => !this.isLast() && !this.projectedSeparator());

  readonly connectorClasses = computed(() =>
    stepperConnectorClasses(
      this.stepper?.orientation() === 'vertical' ? 'vertical' : 'horizontal',
      this.status() === 'complete',
      'flex-1 mt-4',
    )
  );

  classes = computed(() =>
    cn(
      'flex',
      this.stepper?.orientation() === 'vertical' ? 'flex-row gap-4' : 'flex-col items-center gap-2',
      this.class()
    )
  );
}
