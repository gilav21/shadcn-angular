import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { IconComponent, ToggleGroupComponent, ToggleGroupItemComponent } from '../../../../../packages/components/ui';
import { TOGGLE_GROUP_DEMO_LOCALES } from './toggle-group-demo.locales';

@Component({
  selector: 'app-toggle-group-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ToggleGroupComponent, ToggleGroupItemComponent],
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
    </section>
  `,
})
export class ToggleGroupDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => TOGGLE_GROUP_DEMO_LOCALES[this.localeId()] ?? TOGGLE_GROUP_DEMO_LOCALES['en'],
  );
}
