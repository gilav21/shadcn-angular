import { Component, ChangeDetectionStrategy } from '@angular/core';
import { NativeSelectComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-native-select-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NativeSelectComponent],
  template: `
    <section class="space-y-4">
      <h2 id="native-select" class="text-2xl font-semibold scroll-m-20">Native Select</h2>
      <p class="text-muted-foreground">Styled native select element with chevron icon.</p>

      <div class="flex flex-wrap gap-4">
        <ui-native-select>
          <option value="">Select a role</option>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </ui-native-select>

        <ui-native-select size="sm">
          <option value="">Small size</option>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </ui-native-select>

        <ui-native-select [disabled]="true">
          <option value="">Disabled</option>
        </ui-native-select>

        <ui-native-select [invalid]="true">
          <option value="">Invalid state</option>
        </ui-native-select>
      </div>
    </section>
  `,
})
export class NativeSelectDemoComponent {}
