import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  InjectionToken,
  forwardRef,
  contentChildren,
  model,
  output,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { StepperItemComponent } from './sub/stepper-item.component';

export type StepStatus = 'pending' | 'current' | 'complete' | 'error';

export interface StepConfig {
  value: string;
  title: string;
  description?: string;
}

export const STEPPER = new InjectionToken<StepperComponent>('STEPPER');

@Component({
  selector: 'ui-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STEPPER, useExisting: forwardRef(() => StepperComponent) }],
  templateUrl: './stepper.component.html',
  host: { class: 'block' },
})
export class StepperComponent {
  class = input('');
  orientation = input<'horizontal' | 'vertical'>('horizontal');
  activeStep = model(0);
  linear = input(false);

  // Simple mode: steps array
  steps = input<StepConfig[]>([]);

  stepChange = output<number>();

  items = contentChildren(StepperItemComponent);

  // For simple mode, use steps array length
  private readonly simpleStepCount = computed(() => this.steps().length);

  classes = computed(() =>
    cn(
      'flex',
      this.orientation() === 'horizontal' ? 'flex-row items-start overflow-x-auto' : 'flex-col',
      this.class()
    )
  );

  stepItemClasses = computed(() =>
    cn(
      'flex shrink-0',
      this.orientation() === 'vertical' ? 'flex-row gap-4' : 'flex-col items-center gap-2'
    )
  );

  stepTriggerClasses = (canClick: boolean): string =>
    cn(
      'group flex items-center gap-3 text-start',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md',
      !canClick && 'cursor-not-allowed opacity-50'
    );

  indicatorClasses = (status: StepStatus): string =>
    cn(
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
      {
        'border-muted bg-muted text-muted-foreground': status === 'pending',
        'border-primary bg-primary text-primary-foreground': status === 'current' || status === 'complete',
        'border-destructive bg-destructive text-destructive-foreground': status === 'error',
      }
    );

  getStepIndex(value: string): number {
    if (this.steps().length > 0) {
      return this.steps().findIndex((s) => s.value === value);
    }
    return this.items().findIndex((item) => item.value() === value);
  }

  getStepStatus(index: number): StepStatus {
    const active = this.activeStep();
    if (index < active) return 'complete';
    if (index === active) return 'current';
    return 'pending';
  }

  getStepStatusByIndex(index: number): StepStatus {
    return this.getStepStatus(index);
  }

  canNavigateTo(index: number): boolean {
    if (!this.linear()) return true;
    return index <= this.activeStep();
  }

  canNavigateToIndex(index: number): boolean {
    return this.canNavigateTo(index);
  }

  goToStep(index: number): void {
    if (this.canNavigateTo(index)) {
      this.activeStep.set(index);
      this.stepChange.emit(index);
    }
  }

  nextStep(): void {
    const count = this.steps().length > 0 ? this.steps().length : this.items().length;
    const next = Math.min(this.activeStep() + 1, count - 1);
    this.goToStep(next);
  }

  prevStep(): void {
    const prev = Math.max(this.activeStep() - 1, 0);
    this.goToStep(prev);
  }
}
