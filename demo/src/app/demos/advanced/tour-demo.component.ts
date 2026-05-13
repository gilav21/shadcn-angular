import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    TourComponent,
    TourStep,
    ButtonComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
} from '../../../../../packages/components/ui';

@Component({
    selector: 'app-tour-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TourComponent,
        ButtonComponent,
        CardComponent,
        CardHeaderComponent,
        CardTitleComponent,
        CardDescriptionComponent,
        CardContentComponent,
    ],
    template: `
        <section class="space-y-8 max-w-3xl">
            <div>
                <h2 id="tour" class="text-2xl font-semibold scroll-m-20">Tour</h2>
                <p class="text-muted-foreground mt-1">
                    A guided walkthrough that highlights elements on the page with a spotlight overlay
                    and an explanatory card. Drive it with a declarative <code>[steps]</code> array.
                </p>
            </div>

            <div class="space-y-4">
                <ui-button id="tour-start-btn" (click)="startTour()">Start tour</ui-button>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ui-card id="tour-feature-1">
                        <ui-card-header>
                            <ui-card-title>Feature One</ui-card-title>
                            <ui-card-description>The main thing.</ui-card-description>
                        </ui-card-header>
                        <ui-card-content>Some content goes here.</ui-card-content>
                    </ui-card>
                    <ui-card id="tour-feature-2">
                        <ui-card-header>
                            <ui-card-title>Feature Two</ui-card-title>
                            <ui-card-description>The second thing.</ui-card-description>
                        </ui-card-header>
                        <ui-card-content>More content here.</ui-card-content>
                    </ui-card>
                </div>
            </div>

            <div class="space-y-3 h-[80vh] flex flex-col justify-end">
                <p class="text-sm text-muted-foreground">Scroll-test region — the next step targets the section below to force a scroll.</p>
            </div>

            <ui-card id="tour-feature-3" class="mt-32">
                <ui-card-header>
                    <ui-card-title>Off-screen Section</ui-card-title>
                    <ui-card-description>This section starts below the fold; the tour will scroll to it.</ui-card-description>
                </ui-card-header>
                <ui-card-content>Final stop of the tour.</ui-card-content>
            </ui-card>

            <ui-tour [steps]="steps" [(active)]="showTour" (done)="onDone()" (stepChange)="onStepChange($event)" />
        </section>
    `,
})
export class TourDemoComponent {
    readonly showTour = signal(false);
    readonly lastStep = signal(-1);
    readonly steps: TourStep[] = [
        { target: '#tour-start-btn', title: 'Welcome', description: 'Click this button anytime to restart the tour.', side: 'bottom' },
        { target: '#tour-feature-1', title: 'Feature One', description: 'This is the primary feature panel.' },
        { target: '#tour-feature-2', title: 'Feature Two', description: 'And this is the secondary one.' },
        { target: '#tour-feature-3', title: 'Off-screen Section', description: 'See how the tour scrolls this into view before highlighting it.', side: 'top' },
    ];

    startTour(): void {
        this.showTour.set(true);
    }

    onDone(): void {
        // Tour finished naturally or was skipped
    }

    onStepChange(index: number): void {
        this.lastStep.set(index);
    }
}
