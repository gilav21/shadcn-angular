import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  RadioGroupComponent,
  RadioGroupItemComponent,
  LabelComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-radio-group-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RadioGroupComponent, RadioGroupItemComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="radio-group" class="text-2xl font-semibold scroll-m-20">Radio Group</h2>
      <p class="text-muted-foreground">Radio button group for single selection.</p>

      <ui-radio-group class="max-w-sm">
        <div class="flex items-center gap-2">
          <ui-radio-group-item value="option1" />
          <ui-label>Default option</ui-label>
        </div>
        <div class="flex items-center gap-2">
          <ui-radio-group-item value="option2" />
          <ui-label>Comfortable spacing</ui-label>
        </div>
        <div class="flex items-center gap-2">
          <ui-radio-group-item value="option3" />
          <ui-label>Compact layout</ui-label>
        </div>
      </ui-radio-group>

      <h3 class="text-lg font-medium mt-8">Simple Mode (With Label Input)</h3>
      <p class="text-muted-foreground text-sm mb-4">Using the label input instead of a separate &lt;ui-label&gt; element.</p>
      <ui-radio-group class="max-w-sm">
        <ui-radio-group-item value="easy" label="Easy to use" />
        <ui-radio-group-item value="flexible" label="Flexible configuration" />
        <ui-radio-group-item value="accessible" label="Fully accessible" />
      </ui-radio-group>

      <h3 class="text-lg font-medium mt-8">Data-Driven Mode</h3>
      <p class="text-muted-foreground text-sm mb-4">Using <code>[options]</code> input.</p>
      <ui-radio-group class="max-w-sm" [options]="radioOptions" />
    </section>
  `,
})
export class RadioGroupDemoComponent {
  readonly radioOptions = ['Default', 'Comfortable', 'Compact'];
}
