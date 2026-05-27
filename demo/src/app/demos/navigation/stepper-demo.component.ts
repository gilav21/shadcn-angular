import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  ButtonComponent,
  StepperComponent,
  StepperContentComponent,
  StepperDescriptionComponent,
  StepperItemComponent,
  StepperTitleComponent,
  StepperTriggerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { STEPPER_DEMO_LOCALES } from './stepper-demo.locales';

@Component({
  selector: 'app-stepper-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StepperComponent,
    StepperItemComponent,
    StepperTriggerComponent,
    StepperTitleComponent,
    StepperDescriptionComponent,
    StepperContentComponent,
    ButtonComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="stepper" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-stepper [(activeStep)]="activeStep">
        <ui-stepper-item value="step-1">
          <ui-stepper-trigger>
            <ui-stepper-title>{{ t().step1Title }}</ui-stepper-title>
            <ui-stepper-description>{{ t().step1Desc }}</ui-stepper-description>
          </ui-stepper-trigger>
          <ui-stepper-content>
            <div class="p-4 border rounded-md space-y-4">
              <p class="text-sm text-muted-foreground">{{ t().step1Content }}</p>
              <ui-button (click)="activeStep.set(1)" (keydown.enter)="activeStep.set(1)">{{ t().continueBtn }}</ui-button>
            </div>
          </ui-stepper-content>
        </ui-stepper-item>
        <ui-stepper-item value="step-2">
          <ui-stepper-trigger>
            <ui-stepper-title>{{ t().step2Title }}</ui-stepper-title>
            <ui-stepper-description>{{ t().step2Desc }}</ui-stepper-description>
          </ui-stepper-trigger>
          <ui-stepper-content>
            <div class="p-4 border rounded-md space-y-4">
              <p class="text-sm text-muted-foreground">{{ t().step2Content }}</p>
              <div class="flex gap-2">
                <ui-button variant="outline" (click)="activeStep.set(0)" (keydown.enter)="activeStep.set(0)">{{ t().backBtn }}</ui-button>
                <ui-button (click)="activeStep.set(2)" (keydown.enter)="activeStep.set(2)">{{ t().continueBtn }}</ui-button>
              </div>
            </div>
          </ui-stepper-content>
        </ui-stepper-item>
        <ui-stepper-item value="step-3">
          <ui-stepper-trigger>
            <ui-stepper-title>{{ t().step3Title }}</ui-stepper-title>
            <ui-stepper-description>{{ t().step3Desc }}</ui-stepper-description>
          </ui-stepper-trigger>
          <ui-stepper-content>
            <div class="p-4 border rounded-md space-y-4">
              <p class="text-sm text-muted-foreground">{{ t().step3Content }}</p>
              <ui-button variant="outline" (click)="activeStep.set(1)" (keydown.enter)="activeStep.set(1)">{{ t().backBtn }}</ui-button>
            </div>
          </ui-stepper-content>
        </ui-stepper-item>
      </ui-stepper>

      <h2 id="stepper-secondary" class="text-2xl font-semibold scroll-m-20 mt-12">{{ t().heading2 }}</h2>
      <p class="text-muted-foreground">{{ t().description2 }}</p>

      <ui-stepper [activeStep]="1">
        <ui-stepper-item value="step-1">
          <ui-stepper-trigger>
            <div class="flex flex-col items-start gap-1">
              <ui-stepper-title>{{ t().step1b }}</ui-stepper-title>
              <ui-stepper-description>{{ t().step1bDesc }}</ui-stepper-description>
            </div>
          </ui-stepper-trigger>
          <ui-stepper-content>{{ t().step1bContent }}</ui-stepper-content>
        </ui-stepper-item>
        <ui-stepper-item value="step-2">
          <ui-stepper-trigger>
            <div class="flex flex-col items-start gap-1">
              <ui-stepper-title>{{ t().step2b }}</ui-stepper-title>
              <ui-stepper-description>{{ t().step2bDesc }}</ui-stepper-description>
            </div>
          </ui-stepper-trigger>
          <ui-stepper-content>{{ t().step2bContent }}</ui-stepper-content>
        </ui-stepper-item>
        <ui-stepper-item value="step-3">
          <ui-stepper-trigger>
            <div class="flex flex-col items-start gap-1">
              <ui-stepper-title>{{ t().step3b }}</ui-stepper-title>
              <ui-stepper-description>{{ t().step3bDesc }}</ui-stepper-description>
            </div>
          </ui-stepper-trigger>
          <ui-stepper-content>{{ t().step3bContent }}</ui-stepper-content>
        </ui-stepper-item>
      </ui-stepper>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDesc }}</p>
      <ui-stepper [steps]="steps()" />
    </section>
  `,
})
export class StepperDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => STEPPER_DEMO_LOCALES[this.localeId()] ?? STEPPER_DEMO_LOCALES['en']);

  readonly activeStep = signal(0);

  protected readonly steps = computed(() => [
    { title: this.t().simpleStep1Title, description: this.t().simpleStep1Desc, value: 'info' },
    { title: this.t().simpleStep2Title, description: this.t().simpleStep2Desc, value: 'account' },
    { title: this.t().simpleStep3Title, description: this.t().simpleStep3Desc, value: 'review' },
  ]);
}
