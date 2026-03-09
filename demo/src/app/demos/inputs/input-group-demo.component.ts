import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  ButtonComponent,
  IconComponent,
  InputComponent,
  InputGroupComponent,
  InputGroupAddonComponent,
  InputGroupTextComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-input-group-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    IconComponent,
    InputComponent,
    InputGroupComponent,
    InputGroupAddonComponent,
    InputGroupTextComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="input-group" class="text-2xl font-semibold scroll-m-20">Input Group</h2>
      <p class="text-muted-foreground">Group inputs with addons like icons, text, and buttons.</p>

      <div class="grid gap-4 max-w-md">
        <ui-input-group>
          <ui-input-group-addon>
            <ui-icon name="search" size="sm" />
          </ui-input-group-addon>
          <ui-input placeholder="Search..." />
        </ui-input-group>

        <ui-input-group>
          <ui-input-group-addon>$</ui-input-group-addon>
          <ui-input placeholder="0.00" type="number" />
          <ui-input-group-addon align="inline-end">
            <ui-input-group-text>USD</ui-input-group-text>
          </ui-input-group-addon>
        </ui-input-group>

        <ui-input-group>
          <ui-input-group-addon>
            <ui-icon name="map-pin" size="sm" />
          </ui-input-group-addon>
          <ui-input placeholder="Enter location" />
          <ui-input-group-addon align="inline-end">
            <ui-button variant="ghost" size="sm">Locate</ui-button>
          </ui-input-group-addon>
        </ui-input-group>
      </div>
    </section>
  `,
})
export class InputGroupDemoComponent {}
