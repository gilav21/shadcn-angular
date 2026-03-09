import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CheckboxComponent, LabelComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-checkbox-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="checkbox" class="text-2xl font-semibold scroll-m-20">Checkbox</h2>
      <p class="text-muted-foreground">Checkbox component for boolean selection.</p>

      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <ui-checkbox />
          <ui-label>Accept terms and conditions</ui-label>
        </div>
        <div class="flex items-center gap-2">
          <ui-checkbox />
          <ui-label>Subscribe to newsletter</ui-label>
        </div>
        <div class="flex items-center gap-2">
          <ui-checkbox [disabled]="true" />
          <ui-label class="opacity-50">Disabled checkbox</ui-label>
        </div>
      </div>

      <h3 class="text-lg font-medium mt-8">Simple Mode (With Label Input)</h3>
      <p class="text-muted-foreground text-sm mb-4">Using the label input instead of a separate &lt;ui-label&gt; element.</p>
      <div class="space-y-3 flex flex-col gap-2">
        <ui-checkbox label="Accept terms and conditions" />
        <ui-checkbox label="Subscribe to newsletter" [checked]="true" />
        <ui-checkbox label="Disabled checkbox" [disabled]="true" />
      </div>
    </section>
  `,
})
export class CheckboxDemoComponent {}
