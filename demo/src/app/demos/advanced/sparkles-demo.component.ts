import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SparklesButtonComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-sparkles-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SparklesButtonComponent],
  template: `
    <section class="space-y-4">
      <h2 id="sparkles" class="text-2xl font-semibold scroll-m-20">Sparkles</h2>
      <p class="text-muted-foreground">Animated particles effect.</p>
      <div class="flex gap-4 items-center">
        <ui-sparkles-button>Magic Button</ui-sparkles-button>
      </div>
    </section>
  `,
})
export class SparklesDemoComponent {}
