import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ColorPickerComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-color-picker-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ColorPickerComponent],
  template: `
    <section class="space-y-4">
      <h2 id="color-picker" class="text-2xl font-semibold scroll-m-20">Color Picker</h2>
      <p class="text-muted-foreground">
        A popover component with a spectrum, hex/rgb inputs, and preset swatches.
      </p>

      <div class="flex items-center gap-4">
        <ui-color-picker [ngModel]="demoColor()" (ngModelChange)="demoColor.set($event)" [presets]="colorPresets"
          class="w-48" />
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">Selected:</span>
          <span class="h-8 w-8 rounded border" [style.backgroundColor]="demoColor()"></span>
          <code class="text-sm font-mono">{{ demoColor() }}</code>
        </div>
      </div>
    </section>
  `,
})
export class ColorPickerDemoComponent {
  readonly demoColor = signal('#3b82f6');
  readonly colorPresets = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
}
