import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    ElementRef,
    inject,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-flip-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <span [class]="classes()" [attr.data-slot]="'flip-text'">
            @for (char of characters(); track $index) {
                <span
                    class="inline-block animate-flip-in"
                    [style.animationDelay]="$index * delay() + 'ms'"
                    [style.animationDuration]="duration() + 'ms'"
                >{{ char === ' ' ? '\u00A0' : char }}</span>
            }
        </span>
    `,
    styles: [`
        @keyframes flip-in {
            0% {
                opacity: 0;
                transform: rotateX(90deg);
                filter: blur(4px);
            }
            100% {
                opacity: 1;
                transform: rotateX(0deg);
                filter: blur(0);
            }
        }

        .animate-flip-in {
            opacity: 0;
            animation: flip-in forwards cubic-bezier(0.2, 0.6, 0.35, 1);
        }

        @media (prefers-reduced-motion: reduce) {
            .animate-flip-in {
                animation: none;
                opacity: 1;
                transform: none;
                filter: none;
            }
        }
    `],
    host: { class: 'contents' },
})
export class FlipTextComponent {
    private readonly el = inject(ElementRef);

    class = input('');
    text = input('');
    delay = input(50);
    duration = input(500);

    classes = computed(() => cn('inline-flex', this.class()));
    characters = computed(() => this.text().split(''));

    playAnimation() {
        const host = this.el.nativeElement as HTMLElement;
        const chars = host.querySelectorAll('.animate-flip-in') as NodeListOf<HTMLElement>;
        chars.forEach((el, i) => {
            el.getAnimations().forEach(a => a.cancel());
            el.style.opacity = '0';
            el.animate(
                [
                    { opacity: 0, transform: 'rotateX(90deg)', filter: 'blur(4px)' },
                    { opacity: 1, transform: 'rotateX(0deg)', filter: 'blur(0)' },
                ],
                {
                    duration: this.duration(),
                    delay: i * this.delay(),
                    easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)',
                    fill: 'forwards',
                }
            );
        });
    }
}
