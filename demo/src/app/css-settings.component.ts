import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import {
  ButtonComponent,
  IconComponent,
  PopoverComponent,
  PopoverTriggerComponent,
  PopoverContentComponent,
  SliderComponent,
  LabelComponent,
} from '../../../packages/components/ui';

const DENSITY_MULTIPLIERS: Record<number, number> = {
  1: 0.75,
  2: 0.875,
  3: 1,
  4: 1.125,
  5: 1.25,
};

const DENSITY_LABELS: Record<number, string> = {
  1: 'Compact',
  2: 'Tight',
  3: 'Default',
  4: 'Spacious',
  5: 'Comfortable',
};

@Component({
  selector: 'app-css-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    IconComponent,
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
    SliderComponent,
    LabelComponent,
  ],
  template: `
    <ui-popover>
      <ui-popover-trigger>
        <ui-button variant="ghost" size="icon" aria-label="CSS settings">
          <ui-icon name="sliders-horizontal" size="sm" />
        </ui-button>
      </ui-popover-trigger>
      <ui-popover-content align="end" class="w-72">
        <div class="space-y-5 p-1">
          <p class="text-sm font-semibold">CSS Settings</p>

          <!-- Density -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <ui-label>Density</ui-label>
              <span class="text-xs text-muted-foreground">{{ densityLabel() }}</span>
            </div>
            <ui-slider
              #densitySlider
              [min]="1"
              [max]="5"
              [step]="1"
              [defaultValue]="densityLevel()"
              (valueChange)="setDensity($event)"
              ariaLabel="Density level"
            />
          </div>

          <!-- Radius -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <ui-label>Radius</ui-label>
              <span class="text-xs text-muted-foreground">{{ radiusDisplay() }}</span>
            </div>
            <ui-slider
              #radiusSlider
              [min]="0"
              [max]="1"
              [step]="0.05"
              [defaultValue]="radiusValue()"
              (valueChange)="setRadius($event)"
              ariaLabel="Border radius"
            />
          </div>

          <!-- Motion -->
          <div class="space-y-2">
            <ui-label>Motion</ui-label>
            <div class="flex gap-1.5 mt-1.5">
              @for (opt of motionOptions; track opt.value) {
                <ui-button
                  [variant]="motionLevel() === opt.value ? 'default' : 'outline'"
                  size="sm"
                  class="flex-1"
                  (click)="setMotion(opt.value)"
                >{{ opt.label }}</ui-button>
              }
            </div>
          </div>

          <!-- Reset -->
          <ui-button variant="outline" size="sm" class="w-full" (click)="reset()">
            Reset to defaults
          </ui-button>
        </div>
      </ui-popover-content>
    </ui-popover>
  `,
})
export class CssSettingsComponent {
  private readonly densitySliderRef = viewChild<SliderComponent>('densitySlider');
  private readonly radiusSliderRef = viewChild<SliderComponent>('radiusSlider');

  readonly densityLevel = signal(3);
  readonly radiusValue = signal(0.625);
  readonly motionLevel = signal(1);

  readonly densityLabel = computed(() => DENSITY_LABELS[this.densityLevel()] ?? 'Default');
  readonly radiusDisplay = computed(() => `${this.radiusValue().toFixed(3)}rem`);

  readonly motionOptions: ReadonlyArray<{ readonly value: number; readonly label: string }> = [
    { value: 0, label: 'None' },
    { value: 1, label: 'Default' },
    { value: 1.5, label: 'Expressive' },
  ];

  setDensity(level: number) {
    this.densityLevel.set(level);
    document.documentElement.style.setProperty('--density', String(DENSITY_MULTIPLIERS[level] ?? 1));
  }

  setRadius(value: number) {
    const rounded = Math.round(value * 1000) / 1000;
    this.radiusValue.set(rounded);
    document.documentElement.style.setProperty('--radius', `${rounded}rem`);
  }

  setMotion(value: number) {
    this.motionLevel.set(value);
    document.documentElement.style.setProperty('--motion', String(value));
  }

  reset() {
    this.densityLevel.set(3);
    this.radiusValue.set(0.625);
    this.motionLevel.set(1);
    this.densitySliderRef()?.value.set(3);
    this.radiusSliderRef()?.value.set(0.625);
    document.documentElement.style.removeProperty('--density');
    document.documentElement.style.removeProperty('--radius');
    document.documentElement.style.removeProperty('--motion');
  }
}
