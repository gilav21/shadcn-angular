import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
  styleUrl: './skeleton.component.css',
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"skeleton"',
  },
})
export class SkeletonComponent {
  /**
   * Extra classes merged onto the host. The component ships no size of its own,
   * so a width/height (or `size-*`) here is what gives the placeholder its
   * shape — without one it collapses to zero height.
   */
  class = input('');
  /**
   * Placeholder animation. `'pulse'` fades a translucent primary fill in and
   * out; `'shimmer'` sweeps a highlight across it using a hard-coded grey
   * gradient (with a `.dark` variant) rather than theme tokens, and stops
   * entirely under `prefers-reduced-motion: reduce`.
   */
  variant = input<'pulse' | 'shimmer'>('pulse');

  classes = computed(() =>
    cn(
      'rounded-md',
      this.variant() === 'pulse' && 'animate-pulse bg-primary/10',
      this.variant() === 'shimmer' && 'animate-shimmer',
      this.class()
    )
  );
}
