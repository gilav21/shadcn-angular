import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-sparkles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sparkles.component.html',
  styleUrl: './sparkles.component.css',
  host: {
    style: 'display: contents'
  }
})
export class SparklesComponent {
  /**
   * Extra classes merged onto the sparkle `<svg>`. This is the whole API: the
   * sparkle is absolutely positioned and click-through, so its placement
   * (`top-*`/`start-*`), size (`w-*`/`h-*`), colour (it fills with
   * `currentColor`) and animation `delay-*` all come from here. The positioning
   * parent must be `relative`.
   */
  class = input('');
  classes = computed(() => cn('pointer-events-none absolute', this.class()));
}
