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

      <ui-tour [steps]="steps" [(active)]="showTour" (done)="onDone()" />
    </section>
  `,
})
export class TourDemoComponent {
  readonly showTour = signal(false);
  readonly steps: TourStep[] = [
    { target: '#tour-start-btn', title: 'Welcome', description: 'Click this button anytime to restart the tour.', side: 'bottom' },
    { target: '#tour-feature-1', title: 'Feature One', description: 'This is the primary feature panel.' },
    { target: '#tour-feature-2', title: 'Feature Two', description: 'And this is the secondary one.' },
  ];

  startTour(): void {
    this.showTour.set(true);
  }

  onDone(): void {
    // Tour finished naturally or was skipped
  }
}
