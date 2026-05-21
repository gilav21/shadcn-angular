import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress.component.html',
  host: { class: 'block' },
})
export class ProgressComponent {
  value = input(0);
  max = input(100);
  class = input('');
  ariaLabel = input<string | undefined>(undefined);
  ariaLabelledby = input<string | undefined>(undefined);

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

  toString(): string {
    return String(this.value());
  }
}
