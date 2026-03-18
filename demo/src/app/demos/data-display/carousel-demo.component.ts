import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CardComponent,
  CardContentComponent,
  CarouselComponent,
  CarouselContentComponent,
  CarouselItemComponent,
  CarouselNextComponent,
  CarouselPreviousComponent,
} from '../../../../../packages/components/ui';

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
      <h2 id="carousel" class="text-2xl font-semibold scroll-m-20">Carousel</h2>
      <p class="text-muted-foreground">A carousel with motion and swipe controls.</p>

      <div class="mx-auto max-w-xs">
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
        <h3 class="text-lg font-medium mb-2">Vertical Carousel</h3>
        <div class="mx-auto max-w-xs">
          <ui-carousel orientation="vertical" class="w-full">
            <ui-carousel-content class="h-[200px]">
              @for (item of [1, 2, 3, 4, 5]; track item) {
              <ui-carousel-item>
                <div class="p-1">
                  <ui-card>
                    <ui-card-content class="flex items-center justify-center p-6">
                      <span class="text-2xl font-semibold">Slide {{ item }}</span>
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
export class CarouselDemoComponent {}
