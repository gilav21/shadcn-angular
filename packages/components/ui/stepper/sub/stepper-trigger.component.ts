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

  readonly stepper = inject(STEPPER, { optional: true });
  readonly item = inject(STEPPER_ITEM, { optional: true });

  stepNumber = computed(() => (this.item?.index() ?? 0) + 1);
  canClick = computed(() => this.stepper?.canNavigateTo(this.item?.index() ?? 0) ?? true);

  classes = computed(() =>
    cn(
      'group flex items-center gap-3 text-start',
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

  onClick(): void {
    const index = this.item?.index();
    if (index !== undefined) {
      this.stepper?.goToStep(index);
    }
  }
}
