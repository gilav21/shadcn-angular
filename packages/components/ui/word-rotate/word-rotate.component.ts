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
    selector: 'ui-word-rotate',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './word-rotate.component.html',
    styleUrl: './word-rotate.component.css',
    host: { class: 'contents' },
})
export class WordRotateComponent implements OnInit, OnDestroy {
    /**
     * Extra classes merged onto the `relative inline-block overflow-hidden`
     * wrapper. The wrapper clips its children, so give it an explicit height
     * (or font sizing) if the rotating words need more room than one line.
     */
    class = input('');
    /**
     * Words cycled through in order, wrapping back to the first. All of them are
     * rendered stacked and offset vertically; only the active one is visible.
     * With 0 or 1 entries no timer starts and the value stays put.
     */
    words = input<string[]>([]);
    /**
     * Milliseconds each word stays on screen before the next slides up. Read
     * once in `ngOnInit` — changing it later does not restart the timer. The
     * timer is never started at all when the user prefers reduced motion.
     */
    duration = input(2000);

    currentIndex = signal(0);
    private intervalId: ReturnType<typeof setInterval> | null = null;

    classes = computed(() => cn(
        'relative inline-block overflow-hidden',
        this.class()
    ));

    /**
     * Transform/opacity utilities positioning the word at `index` in the
     * vertical carousel: the active word sits at rest, the one before it is
     * parked above (already exited) and everything else waits below. Called
     * from the template for each word on every index change.
     */
    wordClasses(index: number): string {
        const current = this.currentIndex();
        if (index === current) return 'translate-y-0 opacity-100';
        if (index === (current - 1 + this.words().length) % this.words().length) {
            return '-translate-y-full opacity-0';
        }
        return 'translate-y-full opacity-0';
    }

    ngOnInit(): void {
        if (prefersReducedMotion() || this.words().length <= 1) return;

        this.intervalId = setInterval(() => {
            this.currentIndex.update(i => (i + 1) % this.words().length);
        }, this.duration());
    }

    ngOnDestroy(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
