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
  index = input(0);
}
