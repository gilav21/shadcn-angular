import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CheckboxComponent, LabelComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-label-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="label" class="text-2xl font-semibold scroll-m-20">Label</h2>
      <p class="text-muted-foreground">Renders an accessible label associated with a control.</p>

      <div class="grid gap-2">
        <div class="flex items-center gap-2">
          <ui-checkbox id="terms" />
          <ui-label htmlFor="terms">Accept terms and conditions</ui-label>
        </div>
      </div>
    </section>
  `,
})
export class LabelDemoComponent {}
