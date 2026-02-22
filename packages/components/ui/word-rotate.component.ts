import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    OnInit,
    OnDestroy,
} from '@angular/core';
import { cn } from '../lib/utils';
import { prefersReducedMotion } from '../lib/utils';

@Component({
    selector: 'ui-word-rotate',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <span [class]="classes()" [attr.data-slot]="'word-rotate'">
            @for (word of words(); track $index) {
                <span
                    class="absolute inset-0 flex items-center justify-center transition-all duration-300"
                    [class]="wordClasses($index)"
                >{{ word }}</span>
            }
        </span>
    `,
    styles: [`
        @media (prefers-reduced-motion: reduce) {
            :host span {
                transition: none !important;
            }
        }
    `],
    host: { class: 'contents' },
})
export class WordRotateComponent implements OnInit, OnDestroy {
    class = input('');
    words = input<string[]>([]);
    duration = input(2000);

    currentIndex = signal(0);
    private intervalId: ReturnType<typeof setInterval> | null = null;

    classes = computed(() => cn(
        'relative inline-block overflow-hidden',
        this.class()
    ));

    wordClasses(index: number) {
        const current = this.currentIndex();
        if (index === current) return 'translate-y-0 opacity-100';
        if (index === (current - 1 + this.words().length) % this.words().length) {
            return '-translate-y-full opacity-0';
        }
        return 'translate-y-full opacity-0';
    }

    ngOnInit() {
        if (prefersReducedMotion() || this.words().length <= 1) return;

        this.intervalId = setInterval(() => {
            this.currentIndex.update(i => (i + 1) % this.words().length);
        }, this.duration());
    }

    ngOnDestroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
