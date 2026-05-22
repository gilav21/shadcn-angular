import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ColorPickerComponent } from '../../../../../packages/components/ui';

@Component({
    selector: 'app-color-picker-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ColorPickerComponent],
    template: `
    <section class="space-y-6">
      <h2 id="color-picker" class="text-2xl font-semibold scroll-m-20">Color Picker</h2>
      <p class="text-muted-foreground">
        A popover with an HSV spectrum, hex/rgb/hsl/oklch inputs, presets,
        recents, eyedropper, image-pick, harmonies, contrast checking, and
        full keyboard control of the saturation/value area.
      </p>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">Default</h3>
        <div class="flex items-center gap-4">
          <ui-color-picker
            [ngModel]="basicColor()"
            (ngModelChange)="basicColor.set($event)"
            [presets]="presets"
            class="w-48"
          />
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">Selected:</span>
            <span class="h-8 w-8 rounded border" [style.backgroundColor]="basicColor()"></span>
            <code class="text-sm font-mono">{{ basicColor() }}</code>
          </div>
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">With alpha</h3>
        <div class="flex items-center gap-4">
          <ui-color-picker
            [ngModel]="alphaColor()"
            (ngModelChange)="alphaColor.set($event)"
            [alpha]="true"
            class="w-48"
          />
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">Selected:</span>
            <span class="h-8 w-8 rounded border" [style.backgroundColor]="alphaColor()"></span>
            <code class="text-sm font-mono">{{ alphaColor() }}</code>
          </div>
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">Eyedropper + image pick</h3>
        <p class="text-sm text-muted-foreground">
          The pipette samples any pixel on screen (Chromium-based browsers).
          The framed-pipette opens a file picker and extracts a dominant
          palette via median-cut.
        </p>
        <div class="flex items-center gap-4">
          <ui-color-picker
            [ngModel]="toolkitColor()"
            (ngModelChange)="toolkitColor.set($event)"
            [enableEyedropper]="true"
            [enableImagePick]="true"
            [imageExtractCount]="6"
            class="w-48"
          />
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">Selected:</span>
            <span class="h-8 w-8 rounded border" [style.backgroundColor]="toolkitColor()"></span>
            <code class="text-sm font-mono">{{ toolkitColor() }}</code>
          </div>
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">Harmonies + contrast checker</h3>
        <div class="flex items-center gap-4">
          <ui-color-picker
            [ngModel]="harmonyColor()"
            (ngModelChange)="harmonyColor.set($event)"
            [showHarmonies]="true"
            [showContrast]="true"
            contrastBackground="#ffffff"
            class="w-48"
          />
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">Selected:</span>
            <span class="h-8 w-8 rounded border" [style.backgroundColor]="harmonyColor()"></span>
            <code class="text-sm font-mono">{{ harmonyColor() }}</code>
          </div>
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">OKLCH tab + persisted recents</h3>
        <p class="text-sm text-muted-foreground">
          Recents persist across reloads via localStorage. The OKLCH tab
          exposes the perceptually-uniform color space (CSS Color 4).
        </p>
        <div class="flex items-center gap-4">
          <ui-color-picker
            [ngModel]="oklchColor()"
            (ngModelChange)="oklchColor.set($event)"
            [formats]="['hex', 'rgb', 'hsl', 'oklch']"
            storageKey="demo-recents"
            class="w-48"
          />
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">Selected:</span>
            <span class="h-8 w-8 rounded border" [style.backgroundColor]="oklchColor()"></span>
            <code class="text-sm font-mono">{{ oklchColor() }}</code>
          </div>
        </div>
      </article>
    </section>
  `,
})
export class ColorPickerDemoComponent {
    readonly basicColor = signal('#3b82f6');
    readonly alphaColor = signal('#3b82f6cc');
    readonly toolkitColor = signal('#22c55e');
    readonly harmonyColor = signal('#fbbf24');
    readonly oklchColor = signal('#ec4899');
    readonly presets = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
}
