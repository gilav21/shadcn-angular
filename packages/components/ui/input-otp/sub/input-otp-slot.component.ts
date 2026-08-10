import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';

@Component({
  selector: 'ui-input-otp-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
  host: { class: 'hidden' },
})
export class InputOTPSlotComponent {
  /**
   * Zero-based position this slot marks up. Declarative only: `ui-input-otp`
   * renders its own slots from `maxLength`, and this component is hidden, so
   * the index is kept purely for shadcn API parity.
   */
  index = input(0);
}
