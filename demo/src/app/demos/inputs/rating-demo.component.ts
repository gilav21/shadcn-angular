import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RatingComponent, LabelComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-rating-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RatingComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="rating" class="text-2xl font-semibold scroll-m-20">Rating</h2>
      <p class="text-muted-foreground">
        An interactive star rating input.
      </p>

      <div class="space-y-4">
        <div class="space-y-2 flex items-center gap-1">
          <ui-label class="text-sm font-medium">Default ({{ demoRating() }} stars)</ui-label>
          <ui-rating [ngModel]="demoRating()" (ngModelChange)="demoRating.set($event)" />
        </div>

        <div class="space-y-2 flex items-center gap-1">
          <ui-label class="text-sm font-medium">Half Precision ({{ demoRatingHalf() }} stars)</ui-label>
          <ui-rating [ngModel]="demoRatingHalf()" (ngModelChange)="demoRatingHalf.set($event)" [precision]="0.5" />
        </div>

        <div class="space-y-2 flex items-center gap-1">
          <ui-label class="text-sm font-medium">Readonly</ui-label>
          <ui-rating [ngModel]="4" [readonly]="true" />
        </div>

        <div class="space-y-2 flex items-center gap-1">
          <ui-label class="text-sm font-medium">Large Size (10 stars)</ui-label>
          <ui-rating [ngModel]="7" [max]="10" size="lg" [readonly]="true" />
        </div>
      </div>
    </section>
  `,
})
export class RatingDemoComponent {
  readonly demoRating = signal(3);
  readonly demoRatingHalf = signal(2.5);
}
