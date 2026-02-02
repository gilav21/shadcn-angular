import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-text-reveal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()">
      @for (word of words(); track $index) {
        <span 
          class="inline-block transition-all duration-500 will-change-[transform,opacity,filter]"
          [style.animation-delay]="$index * delay() + 'ms'"
          [class]="'opacity-0 animate-blur-in'"
        >
          {{ word }}&nbsp;
        </span>
      }
    </div>
  `,
    styles: [`
    .animate-blur-in {
      animation: blur-in 1s forwards cubic-bezier(0.2, 0.2, 0, 1);
    }
    @keyframes blur-in {
      0% {
        opacity: 0;
        filter: blur(10px);
        transform: translateY(10px);
      }
      100% {
        opacity: 1;
        filter: blur(0);
        transform: translateY(0);
      }
    }
  `]
})
export class TextRevealComponent {
    text = input('');
    class = input('');
    delay = input(50); // ms per word

    classes = computed(() => cn('flex flex-wrap', this.class()));

    words = computed(() => this.text().split(' '));
}
