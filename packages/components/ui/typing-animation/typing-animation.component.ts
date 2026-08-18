import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    OnInit,
    OnDestroy,
    output,
} from '@angular/core';
import { cn, prefersReducedMotion } from '../../lib/utils';

type TypingState = 'typing' | 'pausing' | 'deleting' | 'waiting';

@Component({
    selector: 'ui-typing-animation',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './typing-animation.component.html',
    styleUrl: './typing-animation.component.css',
    host: { class: 'contents' },
})
export class TypingAnimationComponent implements OnInit, OnDestroy {
    /** Extra classes merged onto the inline wrapper. Because the text length changes constantly, give the surrounding layout a fixed width if you need to avoid reflow. */
    class = input('');
    /**
     * Phrases typed one after another, each deleted before the next. Read fresh
     * on every tick, so the list may change mid-run. All of them are also
     * exposed to assistive tech at once via `accessibleText` — the animation
     * itself is `aria-hidden` decoration.
     */
    strings = input<string[]>([]);
    /** Milliseconds between characters while typing forwards. Read per character, so it can be changed live. */
    typeSpeed = input(50);
    /** Milliseconds between characters while deleting — usually set lower than {@link typeSpeed}, since erasing reads better fast. */
    deleteSpeed = input(30);
    /** Milliseconds a finished phrase stays on screen before it starts deleting. A further fixed 300ms gap follows deletion, before the next phrase begins. */
    pauseDuration = input(1500);
    /** Cycles back to the first phrase forever. When `false`, the run stops with the last phrase left on screen and {@link complete} is emitted. */
    loop = input(true);
    /** Shows the caret after the text. It blinks only while paused between phrases and stays solid while characters are moving. */
    cursor = input(true);
    /**
     * Emitted once the final phrase has been typed, which only ever happens when
     * {@link loop} is `false`. Never emitted for a looping animation, nor when
     * the user prefers reduced motion (the first phrase is then shown at once,
     * with no run at all).
     */
    complete = output<void>();

    displayText = signal('');
    private readonly state = signal<TypingState>('typing');
    private stringIndex = 0;
    private charIndex = 0;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;

    classes = computed(() => cn('inline', this.class()));

    /**
     * The complete text, exposed to assistive tech in an `sr-only` span while the
     * character-by-character output is `aria-hidden`. The animated text is empty
     * until the first character lands — so a heading built from this component
     * reached screen readers with no content at all (axe `empty-heading`) — and
     * announcing each keystroke as it arrives would be unusable regardless. The
     * typing is decoration; the phrases are the content.
     */
    readonly accessibleText = computed(() => this.strings().join(', '));

    /**
     * Class applied to the caret: it blinks only while the animation is idle
     * between phrases, and stays solid while characters are being typed or
     * deleted — which is how a real caret behaves.
     */
    blinkClass(): string {
        const s = this.state();
        return s === 'pausing' || s === 'waiting' ? 'cursor-blink' : '';
    }

    ngOnInit(): void {
        const strs = this.strings();
        if (strs.length === 0) return;

        if (prefersReducedMotion()) {
            this.displayText.set(strs[0]);
            return;
        }

        this.tick();
    }

    ngOnDestroy(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    private tick(): void {
        const strs = this.strings();
        const current = strs[this.stringIndex];
        const s = this.state();

        if (s === 'typing') {
            if (this.charIndex < current.length) {
                this.charIndex++;
                this.displayText.set(current.slice(0, this.charIndex));
                this.timeoutId = setTimeout(() => this.tick(), this.typeSpeed());
            } else {
                if (!this.loop() && this.stringIndex === strs.length - 1) {
                    this.complete.emit();
                    return;
                }
                this.state.set('pausing');
                this.timeoutId = setTimeout(() => this.tick(), this.pauseDuration());
            }
        } else if (s === 'pausing') {
            this.state.set('deleting');
            this.tick();
        } else if (s === 'deleting') {
            if (this.charIndex > 0) {
                this.charIndex--;
                this.displayText.set(current.slice(0, this.charIndex));
                this.timeoutId = setTimeout(() => this.tick(), this.deleteSpeed());
            } else {
                this.stringIndex = (this.stringIndex + 1) % strs.length;
                this.state.set('waiting');
                this.timeoutId = setTimeout(() => this.tick(), 300);
            }
        } else if (s === 'waiting') {
            this.state.set('typing');
            this.tick();
        }
    }
}
