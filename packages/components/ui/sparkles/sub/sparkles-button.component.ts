import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ButtonComponent } from '../../button';
import { SparklesComponent } from '../sparkles.component';

@Component({
  selector: 'ui-sparkles-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, SparklesComponent],
  templateUrl: './sparkles-button.component.html',
})
export class SparklesButtonComponent {
  class = input('');
  variant = input<"default" | "destructive" | "outline" | "secondary" | "ghost" | "link">('default');
  size = input<"default" | "sm" | "lg" | "icon">('default');

  hovering = signal(false);
  classes = computed(() => cn('relative overflow-visible group gap-2', this.class()));

  startSparkles() {
    this.hovering.set(true);
  }

  stopSparkles() {
    this.hovering.set(false);
  }
}
