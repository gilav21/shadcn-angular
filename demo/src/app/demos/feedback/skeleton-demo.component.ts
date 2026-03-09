import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SkeletonComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-skeleton-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  template: `
    <section class="space-y-4">
      <h2 id="skeleton" class="text-2xl font-semibold scroll-m-20">Skeleton</h2>
      <p class="text-muted-foreground">Loading placeholder animations.</p>

      <div class="flex items-center gap-4">
        <ui-skeleton class="h-12 w-12 rounded-full" />
        <ui-skeleton class="w-52 h-12 rounded-lg" />
      </div>
      <div class="flex items-center gap-4">
        <ui-skeleton class="w-68 h-12 rounded-lg" />
      </div>
    </section>
  `,
})
export class SkeletonDemoComponent {}
