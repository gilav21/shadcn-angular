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
  /** Extra classes merged onto the inner button. Keep `overflow-visible` intact — the sparkles are positioned outside the button box and would be clipped otherwise. */
  class = input('');
  /** Forwarded to the underlying {@link ButtonComponent} variant, unchanged. Sparkle colours are fixed and do not follow it, so check contrast on dark variants. */
  variant = input<"default" | "destructive" | "outline" | "secondary" | "ghost" | "link">('default');
  /** Forwarded to the underlying {@link ButtonComponent} size, unchanged. The sparkles are positioned in percentages, so they scale with the button. */
  size = input<"default" | "sm" | "lg" | "icon">('default');

  hovering = signal(false);
  classes = computed(() => cn('relative overflow-visible group gap-2', this.class()));

  /**
   * Adds the three sparkles around the button. Bound to `mouseenter`, but public
   * so the effect can be driven from elsewhere — call it to show sparkles on
   * touch devices, which never fire hover events.
   */
  startSparkles(): void {
    this.hovering.set(true);
  }

  /** Removes the sparkles. Bound to `mouseleave`; pair it with {@link startSparkles} when driving the effect manually. */
  stopSparkles(): void {
    this.hovering.set(false);
  }
}
