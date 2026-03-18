import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IconComponent, ToggleGroupComponent, ToggleGroupItemComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-toggle-group-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ToggleGroupComponent, ToggleGroupItemComponent],
  template: `
    <section class="space-y-4">
      <h2 id="toggle-group" class="text-2xl font-semibold scroll-m-20">Toggle Group</h2>
      <p class="text-muted-foreground">A set of two-state buttons that can be toggled on or off.</p>

      <div class="space-y-4">
        <div>
          <p class="text-sm text-muted-foreground mb-2">Single selection:</p>
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
          <p class="text-sm text-muted-foreground mb-2">Multiple selection:</p>
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
export class ToggleGroupDemoComponent {}
