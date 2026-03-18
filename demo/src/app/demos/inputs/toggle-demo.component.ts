import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IconComponent, ToggleComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-toggle-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToggleComponent, IconComponent],
  template: `
    <section class="space-y-4">
      <h2 id="toggle" class="text-2xl font-semibold scroll-m-20">Toggle</h2>
      <p class="text-muted-foreground">A two-state button that can be toggled on or off.</p>

      <div class="flex flex-wrap gap-4">
        <ui-toggle>
          <ui-icon name="zap" />
        </ui-toggle>
        <ui-toggle variant="outline">
          <ui-icon name="eye" />
        </ui-toggle>
        <ui-toggle [defaultPressed]="true">Bold</ui-toggle>
      </div>
    </section>
  `,
})
export class ToggleDemoComponent {}
