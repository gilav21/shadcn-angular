import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    ElementRef,
    inject,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-flip-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './flip-text.component.html',
    styleUrl: './flip-text.component.css',
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

    displayChar(char: string): string {
        return char === ' ' ? ' ' : char;
    }

    playAnimation() {
        const host = this.el.nativeElement as HTMLElement;
        const chars = host.querySelectorAll<HTMLElement>('.animate-flip-in');
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
