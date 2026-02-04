import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  InjectionToken,
  forwardRef,
  contentChildren,
  model,
  output,
  signal,
} from '@angular/core';
import { cn } from '../lib/utils';

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
  template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'stepper'"
      [attr.data-orientation]="orientation()"
      role="list"
    >
      @if (steps().length > 0) {
        <!-- Simple mode: auto-generate stepper items -->
        @for (step of steps(); track step.value; let idx = $index; let last = $last) {
          <div class="contents" role="listitem">
            <div
              [class]="stepItemClasses()"
              [attr.data-slot]="'stepper-item'"
              [attr.data-status]="getStepStatusByIndex(idx)"
              [attr.data-orientation]="orientation()"
            >
              <button
                type="button"
                [class]="stepTriggerClasses(canNavigateToIndex(idx))"
                [attr.data-slot]="'stepper-trigger'"
                [attr.data-status]="getStepStatusByIndex(idx)"
                [disabled]="!canNavigateToIndex(idx)"
                (click)="goToStep(idx)"
              >
                <div [class]="indicatorClasses(getStepStatusByIndex(idx))">
                  @if (getStepStatusByIndex(idx) === 'complete') {
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  } @else {
                    <span class="text-sm font-medium">{{ idx + 1 }}</span>
                  }
                </div>
                <div class="flex flex-col items-start">
                  <span class="text-sm font-medium" data-slot="stepper-title">{{ step.title }}</span>
                  @if (step.description) {
                    <span class="text-xs text-muted-foreground" data-slot="stepper-description">{{ step.description }}</span>
                  }
                </div>
              </button>
            </div>
            @if (!last && orientation() === 'horizontal') {
              <div class="flex-1 h-0.5 bg-border mt-4" [class.bg-primary]="getStepStatusByIndex(idx) === 'complete'"></div>
            }
          </div>
        }
      } @else {
        <!-- Template mode: project content -->
        <ng-content />
      }
    </div>
  `,
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

  items = contentChildren(forwardRef(() => StepperItemComponent));

  // For simple mode, use steps array length
  private simpleStepCount = computed(() => this.steps().length);

  classes = computed(() =>
    cn(
      'flex',
      this.orientation() === 'horizontal' ? 'flex-row items-start' : 'flex-col',
      this.class()
    )
  );

  stepItemClasses = computed(() =>
    cn(
      'flex',
      this.orientation() === 'vertical' ? 'flex-row gap-4' : 'flex-col items-center gap-2'
    )
  );

  stepTriggerClasses = (canClick: boolean) =>
    cn(
      'group flex items-center gap-3 text-left',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md',
      !canClick && 'cursor-not-allowed opacity-50'
    );

  indicatorClasses = (status: StepStatus) =>
    cn(
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
      {
        'border-muted bg-muted text-muted-foreground': status === 'pending',
        'border-primary bg-primary text-primary-foreground': status === 'current' || status === 'complete',
        'border-destructive bg-destructive text-destructive-foreground': status === 'error',
      }
    );

  getStepIndex(value: string): number {
    // For simple mode, find in steps array
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

  goToStep(index: number) {
    if (this.canNavigateTo(index)) {
      this.activeStep.set(index);
      this.stepChange.emit(index);
    }
  }

  nextStep() {
    const count = this.steps().length > 0 ? this.steps().length : this.items().length;
    const next = Math.min(this.activeStep() + 1, count - 1);
    this.goToStep(next);
  }

  prevStep() {
    const prev = Math.max(this.activeStep() - 1, 0);
    this.goToStep(prev);
  }
}


@Component({
  selector: 'ui-stepper-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  stepper = inject(STEPPER, { optional: true });

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

@Component({
  selector: 'ui-stepper-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'stepper-trigger'"
      [attr.data-status]="item?.status()"
      [disabled]="!canClick()"
      (click)="onClick()"
    >
      <div [class]="indicatorClasses()">
        @if (item?.status() === 'complete') {
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4"
          >
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        } @else if (item?.status() === 'error') {
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4"
          >
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        } @else {
          <span class="text-sm font-medium">{{ stepNumber() }}</span>
        }
      </div>
      <div class="flex flex-col items-start">
        <ng-content />
      </div>
    </button>
  `,
  host: { class: 'contents' },
})
export class StepperTriggerComponent {
  class = input('');

  stepper = inject(STEPPER, { optional: true });
  item = inject(StepperItemComponent, { optional: true });

  stepNumber = computed(() => (this.item?.index() ?? 0) + 1);
  canClick = computed(() => this.stepper?.canNavigateTo(this.item?.index() ?? 0) ?? true);

  classes = computed(() =>
    cn(
      'group flex items-center gap-3 text-left',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md',
      !this.canClick() && 'cursor-not-allowed opacity-50',
      this.class()
    )
  );

  indicatorClasses = computed(() =>
    cn(
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
      {
        'border-muted bg-muted text-muted-foreground': this.item?.status() === 'pending',
        'border-primary bg-primary text-primary-foreground': this.item?.status() === 'current' || this.item?.status() === 'complete',
        'border-destructive bg-destructive text-destructive-foreground': this.item?.status() === 'error',
      }
    )
  );

  onClick() {
    const index = this.item?.index();
    if (index !== undefined) {
      this.stepper?.goToStep(index);
    }
  }
}

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
  class = input('');

  classes = computed(() =>
    cn(
      'text-sm font-medium',
      this.class()
    )
  );
}

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

  stepper = inject(STEPPER, { optional: true });
  item = inject(StepperItemComponent, { optional: true });

  isActive = computed(() => this.item?.status() === 'current');

  classes = computed(() =>
    cn(
      'mt-4',
      this.class()
    )
  );
}

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
  class = input('');

  stepper = inject(STEPPER, { optional: true });
  item = inject(StepperItemComponent, { optional: true });

  isComplete = computed(() => this.item?.status() === 'complete');

  classes = computed(() =>
    cn(
      'transition-colors',
      this.stepper?.orientation() === 'horizontal'
        ? 'mx-2 h-0.5 w-full'
        : 'ml-4 mt-2 mb-2 w-0.5 h-8',
      this.isComplete() ? 'bg-primary' : 'bg-border',
      this.class()
    )
  );
}
