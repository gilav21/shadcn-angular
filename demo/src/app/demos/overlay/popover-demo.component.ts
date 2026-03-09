import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ButtonComponent,
  InputComponent,
  LabelComponent,
  PopoverCloseComponent,
  PopoverComponent,
  PopoverContentComponent,
  PopoverTriggerComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-popover-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    InputComponent,
    LabelComponent,
    PopoverCloseComponent,
    PopoverComponent,
    PopoverContentComponent,
    PopoverTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="popover" class="text-2xl font-semibold scroll-m-20">Popover</h2>
      <p class="text-muted-foreground">Floating content that appears when a trigger is clicked.</p>

      <ui-popover #popover>
        <ui-popover-trigger>
          <ui-button variant="outline">Open Popover</ui-button>
        </ui-popover-trigger>
        <ui-popover-content class="w-80">
          <div class="grid gap-4">
            <div class="space-y-2">
              <h4 class="font-medium leading-none">Dimensions</h4>
              <p class="text-sm text-muted-foreground">Set the dimensions for the layer.</p>
            </div>
            <div class="grid gap-2">
              <div class="grid grid-cols-3 items-center gap-4">
                <ui-label for="width">Width</ui-label>
                <ui-input id="width" defaultValue="100%" class="col-span-2 h-8" />
              </div>
              <div class="grid grid-cols-3 items-center gap-4">
                <ui-label for="maxWidth">Max. width</ui-label>
                <ui-input id="maxWidth" defaultValue="300px" class="col-span-2 h-8" />
              </div>
            </div>
            <div class="flex justify-end">
              <ui-popover-close>
                <ui-button size="sm">Close</ui-button>
              </ui-popover-close>
            </div>
          </div>
        </ui-popover-content>
      </ui-popover>
    </section>
  `,
})
export class PopoverDemoComponent {}
