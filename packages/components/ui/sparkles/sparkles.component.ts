import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

interface Sparkle {
  id: string;
  x: string;
  y: string;
  size: string;
  style: any;
}

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
  class = input('');
  classes = computed(() => cn('pointer-events-none absolute', this.class()));
}
