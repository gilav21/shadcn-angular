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
    class = input('');
    strings = input<string[]>([]);
    typeSpeed = input(50);
    deleteSpeed = input(30);
    pauseDuration = input(1500);
    loop = input(true);
    cursor = input(true);
    complete = output<void>();

    displayText = signal('');
    private readonly state = signal<TypingState>('typing');
    private stringIndex = 0;
    private charIndex = 0;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;

    classes = computed(() => cn('inline', this.class()));

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
