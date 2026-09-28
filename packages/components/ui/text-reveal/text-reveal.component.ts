import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { cn } from '../../lib/utils';

/** HTML's collapsible whitespace; a no-break space is deliberately left out so it can join two words. */
const WHITESPACE_RUN = /[ \t\n\r\f]+/;

@Component({
    selector: 'ui-text-reveal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './text-reveal.component.html',
    styleUrl: './text-reveal.component.css',
})
export class TextRevealComponent {
    /**
     * Sentence to reveal. Split into words at runs of whitespace (spaces, tabs,
     * newlines — the characters HTML collapses), each animated as its own
     * inline block, so line breaks can fall between any two words but never
     * inside one. Leading, trailing and repeated whitespace produce no empty
     * words, and empty text renders none; a no-break space keeps its two words
     * together. Plain text only; markup is escaped.
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

    words = computed(() => this.text().split(WHITESPACE_RUN).filter(word => word !== ''));
}
