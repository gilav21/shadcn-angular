import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ButtonComponent, IconComponent, ToggleGroupComponent, ToggleGroupItemComponent } from '../../../../../packages/components/ui';
import { TOGGLE_GROUP_DEMO_LOCALES } from './toggle-group-demo.locales';

const FORM_EXAMPLE = `// component
readonly prefs = new FormGroup({ styles: new FormControl<string[]>(['bold']) });

<!-- template -->
<form [formGroup]="prefs">
  <ui-toggle-group type="multiple" variant="outline" formControlName="styles"
    [items]="[{ value: 'bold', label: 'B' }, { value: 'italic', label: 'I' }, { value: 'underline', label: 'U' }]" />
</form>`;

@Component({
  selector: 'app-toggle-group-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent, ReactiveFormsModule, ToggleGroupComponent, ToggleGroupItemComponent],
  template: `
    <section class="space-y-4">
      <h2 id="toggle-group" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-4">
        <div>
          <p class="text-sm text-muted-foreground mb-2">{{ t().singleLabel }}</p>
          <ui-toggle-group type="single" variant="outline" defaultValue="center">
            <ui-toggle-group-item value="left">
              <ui-icon name="align-left" />
            </ui-toggle-group-item>
            <ui-toggle-group-item value="center">
              <ui-icon name="align-center" />
            </ui-toggle-group-item>
            <ui-toggle-group-item
              class="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-yellow-500 data-[state=on]:*:[svg]:stroke-yellow-500"
              value="right">
              <ui-icon name="align-right" />
            </ui-toggle-group-item>
          </ui-toggle-group>
        </div>
        <div>
          <p class="text-sm text-muted-foreground mb-2">{{ t().multipleLabel }}</p>
          <ui-toggle-group type="multiple" variant="outline">
            <ui-toggle-group-item value="bold">B</ui-toggle-group-item>
            <ui-toggle-group-item value="italic">I</ui-toggle-group-item>
            <ui-toggle-group-item value="underline">U</ui-toggle-group-item>
          </ui-toggle-group>
        </div>
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().formHeading }}</h3>
      <p class="text-muted-foreground text-sm">{{ t().formDescription }}</p>
      <form [formGroup]="prefs" class="space-y-3">
        <ui-toggle-group
          type="multiple"
          variant="outline"
          formControlName="styles"
          [items]="styleItems"
        />
        <div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span dir="ltr">{{ t().formValueLabel }}: {{ styles().join(', ') || '—' }}</span>
          <ui-button size="sm" variant="outline" (click)="toggleDisabled()">disable() / enable()</ui-button>
        </div>
      </form>
      <pre class="bg-muted overflow-x-auto rounded-md p-3 text-xs" dir="ltr">{{ formExample }}</pre>
    </section>
  `,
})
export class ToggleGroupDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => TOGGLE_GROUP_DEMO_LOCALES[this.localeId()] ?? TOGGLE_GROUP_DEMO_LOCALES['en'],
  );

  protected readonly styleItems = [
    { value: 'bold', label: 'B' },
    { value: 'italic', label: 'I' },
    { value: 'underline', label: 'U' },
  ];
  protected readonly prefs = new FormGroup({ styles: new FormControl<string[]>(['bold'], { nonNullable: true }) });
  protected readonly styles = toSignal(this.prefs.controls.styles.valueChanges, {
    initialValue: this.prefs.controls.styles.value,
  });
  protected readonly formExample = FORM_EXAMPLE;

  protected toggleDisabled(): void {
    const control = this.prefs.controls.styles;
    if (control.disabled) {
      control.enable();
    } else {
      control.disable();
    }
  }
}
