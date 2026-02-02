import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
  selector: 'ui-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"skeleton"',
  },
  styles: [`
    :host.animate-shimmer {
      background: #f6f7f8;
      background: linear-gradient(to right, #f6f7f8 8%, #edeef1 18%, #f6f7f8 33%);
      background-size: 800px 104px;
      animation: shimmer 2s linear infinite forwards;
    }
    .dark .animate-shimmer {
        background: #1e293b;
        background: linear-gradient(to right, #1e293b 8%, #0f172a 18%, #1e293b 33%);
        background-size: 800px 104px;
    }
    @keyframes shimmer {
      0% {
        background-position: -800px 0;
      }
      100% {
        background-position: 800px 0;
      }
    }
  `]
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
