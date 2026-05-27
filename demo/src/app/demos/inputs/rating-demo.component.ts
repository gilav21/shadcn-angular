import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { LabelComponent, RatingComponent } from '../../../../../packages/components/ui';
import { RATING_DEMO_LOCALES } from './rating-demo.locales';

@Component({
  selector: 'app-rating-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RatingComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="rating" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-4">
        <div class="space-y-2 flex items-center gap-1">
          <ui-label class="text-sm font-medium">{{ defaultLabel() }}</ui-label>
          <ui-rating [ngModel]="demoRating()" (ngModelChange)="demoRating.set($event)" />
        </div>

        <div class="space-y-2 flex items-center gap-1">
          <ui-label class="text-sm font-medium">{{ halfLabel() }}</ui-label>
          <ui-rating [ngModel]="demoRatingHalf()" (ngModelChange)="demoRatingHalf.set($event)" [precision]="0.5" />
        </div>

        <div class="space-y-2 flex items-center gap-1">
          <ui-label class="text-sm font-medium">{{ t().labels.readonly }}</ui-label>
          <ui-rating [ngModel]="4" [readonly]="true" />
        </div>

        <div class="space-y-2 flex items-center gap-1">
          <ui-label class="text-sm font-medium">{{ t().labels.largeSize }}</ui-label>
          <ui-rating [ngModel]="7" [max]="10" size="lg" [readonly]="true" />
        </div>
      </div>
    </section>
  `,
})
export class RatingDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => RATING_DEMO_LOCALES[this.localeId()] ?? RATING_DEMO_LOCALES['en']);

  readonly demoRating = signal(3);
  readonly demoRatingHalf = signal(2.5);

  protected readonly defaultLabel = computed(() =>
    this.t().labels.defaultStars.replace('{{value}}', String(this.demoRating())),
  );

  protected readonly halfLabel = computed(() =>
    this.t().labels.halfPrecisionStars.replace('{{value}}', String(this.demoRatingHalf())),
  );
}
