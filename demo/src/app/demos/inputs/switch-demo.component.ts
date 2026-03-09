import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SwitchComponent, LabelComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-switch-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SwitchComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="switch" class="text-2xl font-semibold scroll-m-20">Switch</h2>
      <p class="text-muted-foreground">A control that allows the user to toggle between checked and not checked.</p>

      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <h3 class="text-lg font-medium">Basic</h3>
          <div class="flex items-center space-x-2">
            <ui-switch id="airplane-mode"></ui-switch>
            <ui-label htmlFor="airplane-mode">Airplane Mode</ui-label>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="text-lg font-medium">With Inline Label (Simple Mode)</h3>
          <div class="flex items-center space-x-2">
            <ui-switch label="Notifications"></ui-switch>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="text-lg font-medium">Disabled</h3>
          <div class="flex items-center space-x-2">
            <ui-switch [disabled]="true" label="Disabled Switch"></ui-switch>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class SwitchDemoComponent {}
