import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  ButtonComponent,
  StepperComponent,
  StepperContentComponent,
  StepperDescriptionComponent,
  StepperItemComponent,
  StepperTitleComponent,
  StepperTriggerComponent,
} from '../../../../../packages/components/ui';

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
      <h2 id="stepper" class="text-2xl font-semibold scroll-m-20">Stepper</h2>
      <p class="text-muted-foreground">
        A progress indicator for multi-step forms.
      </p>

      <ui-stepper [(activeStep)]="activeStep">
        <ui-stepper-item value="step-1">
          <ui-stepper-trigger>
            <ui-stepper-title>Account</ui-stepper-title>
            <ui-stepper-description>Create your account</ui-stepper-description>
          </ui-stepper-trigger>
          <ui-stepper-content>
            <div class="p-4 border rounded-md space-y-4">
              <p class="text-sm text-muted-foreground">Enter your account information...</p>
              <ui-button (click)="activeStep.set(1)" (keydown.enter)="activeStep.set(1)">Continue</ui-button>
            </div>
          </ui-stepper-content>
        </ui-stepper-item>
        <ui-stepper-item value="step-2">
          <ui-stepper-trigger>
            <ui-stepper-title>Profile</ui-stepper-title>
            <ui-stepper-description>Set up your profile</ui-stepper-description>
          </ui-stepper-trigger>
          <ui-stepper-content>
            <div class="p-4 border rounded-md space-y-4">
              <p class="text-sm text-muted-foreground">Configure your profile settings...</p>
              <div class="flex gap-2">
                <ui-button variant="outline" (click)="activeStep.set(0)" (keydown.enter)="activeStep.set(0)">Back</ui-button>
                <ui-button (click)="activeStep.set(2)" (keydown.enter)="activeStep.set(2)">Continue</ui-button>
              </div>
            </div>
          </ui-stepper-content>
        </ui-stepper-item>
        <ui-stepper-item value="step-3">
          <ui-stepper-trigger>
            <ui-stepper-title>Complete</ui-stepper-title>
            <ui-stepper-description>Finish setup</ui-stepper-description>
          </ui-stepper-trigger>
          <ui-stepper-content>
            <div class="p-4 border rounded-md space-y-4">
              <p class="text-sm text-muted-foreground">All done! Your account is ready.</p>
              <ui-button variant="outline" (click)="activeStep.set(1)" (keydown.enter)="activeStep.set(1)">Back</ui-button>
            </div>
          </ui-stepper-content>
        </ui-stepper-item>
      </ui-stepper>

      <h2 id="stepper-secondary" class="text-2xl font-semibold scroll-m-20 mt-12">Stepper</h2>
      <p class="text-muted-foreground">A stepper component to display progress through a sequence of steps.</p>

      <ui-stepper [activeStep]="1">
        <ui-stepper-item value="step-1">
          <ui-stepper-trigger>
            <div class="flex flex-col items-start gap-1">
              <ui-stepper-title>Step 1</ui-stepper-title>
              <ui-stepper-description>Enter details</ui-stepper-description>
            </div>
          </ui-stepper-trigger>
          <ui-stepper-content>Completed step content</ui-stepper-content>
        </ui-stepper-item>
        <ui-stepper-item value="step-2">
          <ui-stepper-trigger>
            <div class="flex flex-col items-start gap-1">
              <ui-stepper-title>Step 2</ui-stepper-title>
              <ui-stepper-description>Review</ui-stepper-description>
            </div>
          </ui-stepper-trigger>
          <ui-stepper-content>Active step content</ui-stepper-content>
        </ui-stepper-item>
        <ui-stepper-item value="step-3">
          <ui-stepper-trigger>
            <div class="flex flex-col items-start gap-1">
              <ui-stepper-title>Step 3</ui-stepper-title>
              <ui-stepper-description>Confirm</ui-stepper-description>
            </div>
          </ui-stepper-trigger>
          <ui-stepper-content>Inactive step content</ui-stepper-content>
        </ui-stepper-item>
      </ui-stepper>

      <h3 class="text-lg font-medium mt-8">Simple Mode (Data-driven)</h3>
      <p class="text-muted-foreground text-sm mb-4">Using the steps input array.</p>
      <ui-stepper [steps]="[
        { title: 'Personal Info', description: 'Name and email', value: 'info' },
        { title: 'Account', description: 'Setup password', value: 'account' },
        { title: 'Review', description: 'Check details', value: 'review' }
      ]" />
    </section>
  `,
})
export class StepperDemoComponent {
  readonly activeStep = signal(0);
}
