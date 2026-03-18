import { Component, ChangeDetectionStrategy } from '@angular/core';
import { InputComponent, LabelComponent, InputMaskDirective } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-input-mask-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputComponent, LabelComponent, InputMaskDirective],
  template: `
    <section class="space-y-4">
      <h2 id="input-mask" class="text-2xl font-semibold scroll-m-20">Input Mask</h2>
      <p class="text-muted-foreground">Input masking for formatted data entry.</p>

      <div class="grid gap-4 max-w-sm">
        <div class="space-y-2">
          <ui-label>Phone Number ((000) 000-0000)</ui-label>
          <ui-input uiInputMask="(000) 000-0000" placeholder="(555) 555-5555" />
        </div>

        <div class="space-y-2">
          <ui-label>Date (99/99/9999)</ui-label>
          <ui-input uiInputMask="99/99/9999" slotChar="_" placeholder="MM/DD/YYYY" />
        </div>

        <div class="space-y-2">
          <ui-label>License Plate (AAA-999)</ui-label>
          <ui-input uiInputMask="AAA-999" placeholder="ABC-123" />
        </div>

        <div class="space-y-2">
          <ui-label>Native Input Support</ui-label>
          <input
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            uiInputMask="(000) 000-0000" placeholder="Native input (000) 000-0000" />
        </div>
      </div>
    </section>
  `,
})
export class InputMaskDemoComponent {}
