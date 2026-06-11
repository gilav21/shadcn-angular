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
    text = input('');
    speed = input(30); // ms per char
    class = input('');
    showCursor = input(true);

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
