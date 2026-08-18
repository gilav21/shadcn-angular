import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    effect,
    output,
    OnDestroy,
} from '@angular/core';
import { cn, prefersReducedMotion } from '../../lib/utils';

@Component({
    selector: 'ui-streaming-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './streaming-text.component.html',
})
export class StreamingTextComponent implements OnDestroy {
    /**
     * Target text. Designed for streaming: as long as each new value still
     * starts with the previous one, typing simply continues from where it was.
     * A value that diverges from the previous prefix is treated as a new message
     * and restarts the animation from an empty string.
     */
    text = input('');
    /**
     * Milliseconds between characters. Read when a typing run starts, so
     * changing it mid-run only takes effect after the current run finishes and
     * a new one begins.
     */
    speed = input(30);
    /** Extra classes merged onto the `whitespace-pre-wrap` text container — newlines and runs of spaces in {@link text} are preserved by default. */
    class = input('');
    /** Shows the blinking caret after the typed text. Purely decorative; it does not affect {@link complete} or the typing timing. */
    showCursor = input(true);

    /**
     * Emitted when the displayed text has caught up with {@link text}. Fires
     * once per typing run, so a stream that keeps appending emits repeatedly as
     * it drains — and it fires immediately (with the full text shown) when the
     * user prefers reduced motion.
     */
    complete = output<void>();

    displayedText = signal('');
    isTyping = signal(false);

    classes = computed(() => cn('whitespace-pre-wrap', this.class()));

    private intervalId: ReturnType<typeof setInterval> | null = null;
    private lastInput = '';

    constructor() {
        effect(() => {
            const current = this.text();

            // If new text doesn't start with what we already knew, it's a new message -> reset
            if (!current.startsWith(this.lastInput)) {
                this.displayedText.set('');
                this.lastInput = '';
            }

            this.lastInput = current;
            this.startTyping();
        });
    }

    private startTyping(): void {
        if (this.intervalId) return; // Already typing

        if (prefersReducedMotion()) {
            this.displayedText.set(this.text());
            this.complete.emit();
            return;
        }

        this.isTyping.set(true);

        this.intervalId = setInterval(() => {
            const fullText = this.text();
            const currentLength = this.displayedText().length;

            if (currentLength < fullText.length) {
                this.displayedText.update(t => t + fullText.charAt(currentLength));
            } else {
                this.stopTyping();
                this.complete.emit();
            }
        }, this.speed());
    }

    private stopTyping(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isTyping.set(false);
    }

    ngOnDestroy(): void {
        this.stopTyping();
    }
}
