import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AspectRatioComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-aspect-ratio-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspectRatioComponent],
  template: `
    <section class="space-y-4">
      <h2 id="aspect-ratio" class="text-2xl font-semibold scroll-m-20">Aspect Ratio</h2>
      <p class="text-muted-foreground">Display content within a desired ratio.</p>

      <div class="w-[300px]">
        <ui-aspect-ratio [ratio]="16 / 9">
          <div class="flex h-full w-full items-center justify-center rounded-md bg-muted text-muted-foreground">
            16:9 Aspect Ratio
          </div>
        </ui-aspect-ratio>
      </div>
    </section>
  `,
})
export class AspectRatioDemoComponent {}
