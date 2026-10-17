import {
  Component,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'ui-input-otp-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
  host: { class: 'hidden', '[attr.data-slot]': '"input-otp-group"' },
})
export class InputOTPGroupComponent { }
