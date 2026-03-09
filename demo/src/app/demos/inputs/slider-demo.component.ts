import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SliderComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-slider-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SliderComponent],
  template: `
    <section class="space-y-4">
      <h2 id="slider" class="text-2xl font-semibold scroll-m-20">Slider</h2>
      <p class="text-muted-foreground">Range input component.</p>

      <div class="max-w-xs space-y-4">
        <ui-slider [defaultValue]="40" [min]="0" [max]="100" [step]="1" />
        <div class="flex justify-between text-sm text-muted-foreground">
          <span>0</span>
          <span>100</span>
        </div>
      </div>
    </section>
  `,
})
export class SliderDemoComponent {}
