import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-text-reveal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './text-reveal.component.html',
    styleUrl: './text-reveal.component.css',
})
export class TextRevealComponent {
    /**
     * Sentence to reveal. Split on single spaces into words, each animated as
     * its own inline block — so line breaks can fall between any two words but
     * never inside one. Plain text only; markup is escaped.
     */
    text = input('');
    /** Extra classes merged onto the `flex flex-wrap` word container — set text size, alignment, or `justify-*` here. */
    class = input('');
    /**
     * Stagger between consecutive words, in milliseconds; word *n* starts at
     * `n * delay`. Each word's own blur-in animation runs for a fixed 1s, so a
     * large delay stretches the total reveal rather than slowing each word.
     * Under `prefers-reduced-motion: reduce` the animation is skipped and all
     * words appear at once.
     */
    delay = input(50);

    classes = computed(() => cn('flex flex-wrap', this.class()));

    words = computed(() => this.text().split(' '));
}
