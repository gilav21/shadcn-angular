import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  SelectComponent,
  SelectTriggerComponent,
  SelectValueComponent,
  SelectContentComponent,
  SelectItemComponent,
  SelectGroupComponent,
  SelectLabelComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-select-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent,
    SelectGroupComponent,
    SelectLabelComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="select" class="text-2xl font-semibold scroll-m-20">Select</h2>
      <p class="text-muted-foreground">Select component for choosing from a list of options.</p>

      <div class="flex flex-wrap gap-8">
        <div class="space-y-2">
          <h3 class="text-sm font-medium">Item-Aligned (default)</h3>
          <p class="text-xs text-muted-foreground">Aligns selected item with trigger. Falls back to popper if overflows viewport.</p>
          <ui-select class="w-[200px]" position="item-aligned">
            <ui-select-trigger>
              <ui-select-value placeholder="Select a fruit" />
            </ui-select-trigger>
            <ui-select-content>
              <ui-select-group>
                <ui-select-label>Fruits</ui-select-label>
                <ui-select-item value="apple">Apple</ui-select-item>
                <ui-select-item value="banana">Banana</ui-select-item>
                <ui-select-item value="blueberry">Blueberry</ui-select-item>
                <ui-select-item value="grapes">Grapes</ui-select-item>
                <ui-select-item value="pineapple">Pineapple</ui-select-item>
              </ui-select-group>
            </ui-select-content>
          </ui-select>
        </div>

        <div class="space-y-2">
          <h3 class="text-sm font-medium">Simple Mode (Data-Driven)</h3>
          <p class="text-xs text-muted-foreground">Uses <code>[options]</code> input.</p>
          <ui-select class="w-[200px]" [options]="selectOptions" placeholder="Select a fruit" />
        </div>

        <div class="space-y-2">
          <h3 class="text-sm font-medium">Popper</h3>
          <p class="text-xs text-muted-foreground">Always opens below the trigger.</p>
          <ui-select class="w-[200px]" position="popper">
            <ui-select-trigger>
              <ui-select-value placeholder="Select a fruit" />
            </ui-select-trigger>
            <ui-select-content>
              <ui-select-group>
                <ui-select-label>Fruits</ui-select-label>
                <ui-select-item value="apple">Apple</ui-select-item>
                <ui-select-item value="banana">Banana</ui-select-item>
                <ui-select-item value="blueberry">Blueberry</ui-select-item>
                <ui-select-item value="grapes">Grapes</ui-select-item>
                <ui-select-item value="pineapple">Pineapple</ui-select-item>
              </ui-select-group>
            </ui-select-content>
          </ui-select>
        </div>
      </div>
    </section>
  `,
})
export class SelectDemoComponent {
  readonly selectOptions = ['Apple', 'Banana', 'Blueberry', 'Grapes', 'Pineapple'];
}
