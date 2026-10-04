// demo/src/app/demos/inputs/slider-demo.component.ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ButtonComponent, SliderComponent } from '../../../../../packages/components/ui';
import { SLIDER_DEMO_LOCALES } from './slider-demo.locales';

const FORM_EXAMPLE = `<form [formGroup]="settings">
  <ui-slider formControlName="density" [min]="1" [max]="5" ariaLabel="Density" />
</form>`;

const FRACTIONAL_EXAMPLE = `<ui-slider [defaultValue]="0.65" [min]="0" [max]="1" [step]="0.05"
  ariaLabel="Opacity" (valueChange)="opacity.set($event)" />`;

@Component({
  selector: 'app-slider-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SliderComponent, ButtonComponent, ReactiveFormsModule],
  template: `
    <section class="space-y-4">
      <h2 id="slider" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="max-w-xs space-y-4">
        <ui-slider [defaultValue]="40" [min]="0" [max]="100" [step]="1" [ariaLabel]="t().title" />
        <div class="flex justify-between text-sm text-muted-foreground">
          <span>{{ t().minLabel }}</span>
          <span>{{ t().maxLabel }}</span>
        </div>
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().formHeading }}</h3>
      <p class="text-muted-foreground text-sm">{{ t().formDescription }}</p>
      <form [formGroup]="settings" class="max-w-xs space-y-3">
        <ui-slider formControlName="density" [min]="1" [max]="5" [ariaLabel]="t().densityLabel" />
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{{ t().formValueLabel }}: {{ density() }}</span>
          <ui-button size="sm" variant="outline" (click)="toggleDisabled()">disable() / enable()</ui-button>
        </div>
      </form>
      <pre class="bg-muted overflow-x-auto rounded-md p-3 text-xs" dir="ltr">{{ formExample }}</pre>

      <h3 class="text-lg font-medium mt-8">{{ t().fractionalHeading }}</h3>
      <p class="text-muted-foreground text-sm">{{ t().fractionalDescription }}</p>
      <div class="max-w-xs space-y-2">
        <ui-slider [defaultValue]="0.65" [min]="0" [max]="1" [step]="0.05" [ariaLabel]="t().opacityLabel"
          (valueChange)="opacity.set($event)" />
        <p class="text-sm text-muted-foreground tabular-nums">{{ t().opacityLabel }}: {{ opacity() }}</p>
      </div>
      <pre class="bg-muted overflow-x-auto rounded-md p-3 text-xs" dir="ltr">{{ fractionalExample }}</pre>
    </section>
  `,
})
export class SliderDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => SLIDER_DEMO_LOCALES[this.localeId()] ?? SLIDER_DEMO_LOCALES['en'],
  );

  protected readonly settings = new FormGroup({ density: new FormControl(3) });
  protected readonly density = signal(3);
  protected readonly opacity = signal(0.65);
  protected readonly formExample = FORM_EXAMPLE;
  protected readonly fractionalExample = FRACTIONAL_EXAMPLE;

  constructor() {
    this.settings.controls.density.valueChanges.subscribe(v => this.density.set(v ?? 0));
  }

  protected toggleDisabled(): void {
    const control = this.settings.controls.density;
    if (control.disabled) {
      control.enable();
    } else {
      control.disable();
    }
  }
}
