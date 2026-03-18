import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProgressComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-progress-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressComponent],
  template: `
    <section class="space-y-4">
      <h2 id="progress" class="text-2xl font-semibold scroll-m-20">Progress</h2>
      <p class="text-muted-foreground">Progress bar indicators.</p>

      <div class="space-y-4 max-w-md">
        <ui-progress [value]="25" />
        <ui-progress [value]="50" />
        <ui-progress [value]="75" />
        <ui-progress [value]="100" />
      </div>
    </section>
  `,
})
export class ProgressDemoComponent {}
