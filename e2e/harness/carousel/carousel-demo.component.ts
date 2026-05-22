import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    CarouselComponent,
    CarouselContentComponent,
    CarouselItemComponent,
    CarouselPreviousComponent,
    CarouselNextComponent,
} from '@/components/ui/carousel';

@Component({
    selector: 'app-carousel-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CarouselComponent, CarouselContentComponent, CarouselItemComponent,
        CarouselPreviousComponent, CarouselNextComponent,
    ],
    template: `
        <main class="p-8 w-[600px]">
            <ui-carousel>
                <ui-carousel-content>
                    <ui-carousel-item data-testid="slide-1">Slide 1</ui-carousel-item>
                    <ui-carousel-item data-testid="slide-2">Slide 2</ui-carousel-item>
                    <ui-carousel-item data-testid="slide-3">Slide 3</ui-carousel-item>
                </ui-carousel-content>
                <ui-carousel-previous data-testid="prev" />
                <ui-carousel-next data-testid="next" />
            </ui-carousel>
        </main>
    `,
})
export class CarouselDemoComponent {}
