import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    ElementRef,
    inject,
} from '@angular/core';
import { cn, prefersReducedMotion } from '../../lib/utils';

@Component({
    selector: 'ui-flip-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './flip-text.component.html',
    styleUrl: './flip-text.component.css',
    host: { class: 'contents' },
})
export class FlipTextComponent {
    private readonly el = inject(ElementRef);

    /** Extra classes merged onto the `inline-flex` wrapper. Because the characters are flex items, word wrapping is lost — keep the text short or add `flex-wrap`. */
    class = input('');
    /**
     * Text to animate, split into individual characters that each flip in.
     * Splitting is by UTF-16 code unit, so astral characters (emoji, some CJK
     * extensions) are torn apart — stick to BMP text.
     */
    text = input('');
    /** Stagger between consecutive characters in milliseconds; character *n* starts at `n * delay`. Applied as each span's `animation-delay`. */
    delay = input(50);
    /** Duration of a single character's flip, in milliseconds. Independent of {@link delay}, which only controls the offset between characters. */
    duration = input(500);

    classes = computed(() => cn('inline-flex', this.class()));
    characters = computed(() => this.text().split(''));

    /**
     * Maps a character to what is actually rendered, substituting a
     * non-breaking space for a plain space so the interpolated span is not
     * collapsed away and word gaps survive the per-character split.
     */
    displayChar(char: string): string {
        return char === ' ' ? ' ' : char;
    }

    /**
     * Replays the flip on demand. The CSS animation only runs once on insert, so
     * this cancels any running animations and re-drives the same keyframes
     * imperatively via the Web Animations API. Honours `prefers-reduced-motion`
     * exactly as the CSS path does: under that preference the characters are
     * simply left visible and nothing animates.
     */
    playAnimation(): void {
        const host = this.el.nativeElement as HTMLElement;
        const chars = host.querySelectorAll<HTMLElement>('.animate-flip-in');
        const reducedMotion = prefersReducedMotion();
        chars.forEach((el, i) => {
            el.getAnimations().forEach(a => a.cancel());
            if (reducedMotion) {
                el.style.opacity = '1';
                return;
            }
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
