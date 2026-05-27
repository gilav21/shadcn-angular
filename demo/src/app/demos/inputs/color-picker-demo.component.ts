import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ColorPickerComponent } from '../../../../../packages/components/ui';
import { COLOR_PICKER_DEMO_LOCALES } from './color-picker-demo.locales';

@Component({
  selector: 'app-color-picker-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ColorPickerComponent],
  template: `
    <section class="space-y-6">
      <h2 id="color-picker" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">{{ t().sections.default }}</h3>
        <div class="flex items-center gap-4">
          <ui-color-picker
            [ngModel]="basicColor()"
            (ngModelChange)="basicColor.set($event)"
            [presets]="presets"
            class="w-48"
          />
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">{{ t().selected }}</span>
            <span class="h-8 w-8 rounded border" [style.backgroundColor]="basicColor()"></span>
            <code class="text-sm font-mono">{{ basicColor() }}</code>
          </div>
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">{{ t().sections.withAlpha }}</h3>
        <div class="flex items-center gap-4">
          <ui-color-picker
            [ngModel]="alphaColor()"
            (ngModelChange)="alphaColor.set($event)"
            [alpha]="true"
            class="w-48"
          />
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">{{ t().selected }}</span>
            <span class="h-8 w-8 rounded border" [style.backgroundColor]="alphaColor()"></span>
            <code class="text-sm font-mono">{{ alphaColor() }}</code>
          </div>
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">{{ t().sections.eyedropperImage }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().sections.eyedropperImageDesc }}</p>
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
            <span class="text-sm text-muted-foreground">{{ t().selected }}</span>
            <span class="h-8 w-8 rounded border" [style.backgroundColor]="toolkitColor()"></span>
            <code class="text-sm font-mono">{{ toolkitColor() }}</code>
          </div>
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">{{ t().sections.harmoniesContrast }}</h3>
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
            <span class="text-sm text-muted-foreground">{{ t().selected }}</span>
            <span class="h-8 w-8 rounded border" [style.backgroundColor]="harmonyColor()"></span>
            <code class="text-sm font-mono">{{ harmonyColor() }}</code>
          </div>
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">{{ t().sections.oklchRecents }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().sections.oklchRecentsDesc }}</p>
        <div class="flex items-center gap-4">
          <ui-color-picker
            [ngModel]="oklchColor()"
            (ngModelChange)="oklchColor.set($event)"
            [formats]="['hex', 'rgb', 'hsl', 'oklch']"
            storageKey="demo-recents"
            class="w-48"
          />
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">{{ t().selected }}</span>
            <span class="h-8 w-8 rounded border" [style.backgroundColor]="oklchColor()"></span>
            <code class="text-sm font-mono">{{ oklchColor() }}</code>
          </div>
        </div>
      </article>
    </section>
  `,
})
export class ColorPickerDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => COLOR_PICKER_DEMO_LOCALES[this.localeId()] ?? COLOR_PICKER_DEMO_LOCALES['en']);

  readonly basicColor = signal('#3b82f6');
  readonly alphaColor = signal('#3b82f6cc');
  readonly toolkitColor = signal('#22c55e');
  readonly harmonyColor = signal('#fbbf24');
  readonly oklchColor = signal('#ec4899');
  readonly presets = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
}
