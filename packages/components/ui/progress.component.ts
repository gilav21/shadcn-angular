import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
  selector: 'ui-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="progressbar"
      [attr.aria-valuenow]="value()"
      [attr.aria-valuemin]="0"
      [attr.aria-valuemax]="max()"
      [class]="classes()"
      [attr.data-slot]="'progress'"
    >
      <div
        class="h-full bg-primary transition-all rounded-full"
        [style.width.%]="percentage()"
      ></div>
    </div>
  `,
  host: { class: 'block' },
})
export class ProgressComponent {
  value = input(0);
  max = input(100);
  class = input('');

  percentage = computed(() => {
    const val = this.value();
    const maxVal = this.max();
    return Math.min(100, Math.max(0, (val / maxVal) * 100));
  });

  classes = computed(() =>
    cn(
      'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
      this.class()
    )
  );
}
