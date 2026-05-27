import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  CardComponent,
  CardContentComponent,
  CarouselComponent,
  CarouselContentComponent,
  CarouselItemComponent,
  CarouselNextComponent,
  CarouselPreviousComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CAROUSEL_DEMO_LOCALES } from './carousel-demo.locales';

@Component({
  selector: 'app-carousel-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CarouselComponent,
    CarouselContentComponent,
    CarouselItemComponent,
    CarouselPreviousComponent,
    CarouselNextComponent,
    CardComponent,
    CardContentComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="carousel" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="mx-auto max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
        <ui-carousel class="w-full">
          <ui-carousel-content>
            @for (item of [1, 2, 3, 4, 5]; track item) {
            <ui-carousel-item>
              <div class="p-1">
                <ui-card>
                  <ui-card-content class="flex aspect-square items-center justify-center p-6">
                    <span class="text-4xl font-semibold">{{ item }}</span>
                  </ui-card-content>
                </ui-card>
              </div>
            </ui-carousel-item>
            }
          </ui-carousel-content>
          <ui-carousel-previous />
          <ui-carousel-next />
        </ui-carousel>
      </div>

      <div class="pt-4">
        <h3 class="text-lg font-medium mb-2">{{ t().verticalHeading }}</h3>
        <div class="mx-auto max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
          <ui-carousel orientation="vertical" class="w-full">
            <ui-carousel-content class="h-[200px]">
              @for (item of [1, 2, 3, 4, 5]; track item) {
              <ui-carousel-item>
                <div class="p-1">
                  <ui-card>
                    <ui-card-content class="flex items-center justify-center p-6">
                      <span class="text-2xl font-semibold">{{ t().slideLabel }} {{ item }}</span>
                    </ui-card-content>
                  </ui-card>
                </div>
              </ui-carousel-item>
              }
            </ui-carousel-content>
            <ui-carousel-previous />
            <ui-carousel-next />
          </ui-carousel>
        </div>
      </div>
    </section>
  `,
})
export class CarouselDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => CAROUSEL_DEMO_LOCALES[this.localeId()] ?? CAROUSEL_DEMO_LOCALES['en']);
}
