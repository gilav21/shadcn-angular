import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  ButtonComponent,
  ButtonGroupComponent,
  ButtonGroupTextComponent,
  InputComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-button-group-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ButtonGroupComponent, ButtonGroupTextComponent, InputComponent],
  template: `
    <section class="space-y-4">
      <h2 id="button-group" class="text-2xl font-semibold scroll-m-20">Button Group</h2>
      <p class="text-muted-foreground">Group buttons together with seamless borders.</p>

      <div class="flex flex-wrap gap-6">
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">Horizontal</span>
          <ui-button-group>
            <ui-button variant="outline">Left</ui-button>
            <ui-button variant="outline">Center</ui-button>
            <ui-button variant="outline">Right</ui-button>
          </ui-button-group>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">Vertical</span>
          <ui-button-group orientation="vertical">
            <ui-button variant="outline">Top</ui-button>
            <ui-button variant="outline">Middle</ui-button>
            <ui-button variant="outline">Bottom</ui-button>
          </ui-button-group>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">With Text</span>
          <ui-button-group>
            <ui-button-group-text>https://</ui-button-group-text>
            <ui-input class="rounded-none border-x-0" placeholder="example" />
            <ui-button-group-text>.com</ui-button-group-text>
          </ui-button-group>
        </div>
      </div>
    </section>
  `,
})
export class ButtonGroupDemoComponent {}
