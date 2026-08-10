import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    OnInit,
    OnDestroy,
} from '@angular/core';
import { cn, prefersReducedMotion } from '../../lib/utils';

@Component({
    selector: 'ui-morphing-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './morphing-text.component.html',
    styleUrl: './morphing-text.component.css',
    host: { class: 'contents' },
})
export class MorphingTextComponent implements OnInit, OnDestroy {
    /** Extra classes merged onto the `relative inline-block` wrapper — use it to set the font size/weight the morphing text inherits. */
    class = input('');
    /**
     * Phrases cycled through, in order, looping back to the first. The wrapper
     * is sized to the longest entry so the surrounding layout never reflows
     * mid-cycle. With 0 or 1 entries no timer is started and the single value
     * (or nothing) is shown statically.
     */
    texts = input<string[]>([]);
    /**
     * Milliseconds for a full swap cycle. The internal timer actually fires
     * every `interval / 2` — one tick fades out, the next advances and fades in
     * — and the CSS transition is `min(interval / 3, 500)ms`. Read once in
     * `ngOnInit`; later changes do not restart the timer.
     */
    interval = input(3000);

    private readonly textIndex = signal(0);
    currentVisible = signal(true);
    private intervalId: ReturnType<typeof setInterval> | null = null;

    classes = computed(() => cn('relative inline-block', this.class()));
    transitionDuration = computed(() => `${Math.min(this.interval() / 3, 500)}ms`);

    currentText = computed(() => {
        const t = this.texts();
        return t.length > 0 ? t[this.textIndex() % t.length] : '';
    });

    nextText = computed(() => {
        const t = this.texts();
        return t.length > 0 ? t[(this.textIndex() + 1) % t.length] : '';
    });

    longestText = computed(() => {
        const t = this.texts();
        return t.reduce((longest, text) => text.length > longest.length ? text : longest, '');
    });

    ngOnInit(): void {
        if (prefersReducedMotion() || this.texts().length <= 1) return;

        const halfInterval = this.interval() / 2;
        this.intervalId = setInterval(() => {
            this.currentVisible.update(v => !v);
            if (this.currentVisible()) {
                this.textIndex.update(i => (i + 1) % this.texts().length);
            }
        }, halfInterval);
    }

    ngOnDestroy(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
