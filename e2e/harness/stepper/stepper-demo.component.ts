import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    StepperComponent,
    StepperItemComponent,
    StepperTriggerComponent,
    StepperTitleComponent,
    StepperDescriptionComponent,
    StepperContentComponent,
    StepperSeparatorComponent,
} from '@/components/ui/stepper';

/** Harness for the `stepper` component (`ui-stepper-item` requires `value`). */
@Component({
    selector: 'app-stepper-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        StepperComponent,
        StepperItemComponent,
        StepperTriggerComponent,
        StepperTitleComponent,
        StepperDescriptionComponent,
        StepperContentComponent,
        StepperSeparatorComponent,
    ],
    template: `
        <main class="p-8">
            <ui-stepper data-testid="root" class="block" (stepChange)="current.set($event)">
                <ui-stepper-item data-testid="stepper-item" value="one">
                    <ui-stepper-trigger data-testid="stepper-trigger">
                        <ui-stepper-title data-testid="stepper-title">Account</ui-stepper-title>
                        <ui-stepper-description data-testid="stepper-description">Step one</ui-stepper-description>
                    </ui-stepper-trigger>
                    <ui-stepper-content data-testid="stepper-content">Account details</ui-stepper-content>
                </ui-stepper-item>
                <ui-stepper-separator data-testid="stepper-separator" />
                <ui-stepper-item data-testid="stepper-item-2" value="two">
                    <ui-stepper-trigger data-testid="stepper-trigger-2">
                        <ui-stepper-title>Shipping</ui-stepper-title>
                    </ui-stepper-trigger>
                    <ui-stepper-content>Shipping details</ui-stepper-content>
                </ui-stepper-item>
            </ui-stepper>
            <p data-testid="current">{{ current() }}</p>
        </main>
    `,
})
export class StepperDemoComponent {
    readonly current = signal(-1);
}
