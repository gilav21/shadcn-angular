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
  class = input('');
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
