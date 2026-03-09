import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BadgeComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-badge-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <section class="space-y-4">
      <h2 id="badge" class="text-2xl font-semibold scroll-m-20">Badge</h2>
      <p class="text-muted-foreground">Badge component with variants.</p>

      <div class="flex flex-wrap gap-2">
        <ui-badge>Default</ui-badge>
        <ui-badge variant="secondary">Secondary</ui-badge>
        <ui-badge variant="outline">Outline</ui-badge>
        <ui-badge variant="destructive">Destructive</ui-badge>
      </div>
    </section>
  `,
})
export class BadgeDemoComponent {}
