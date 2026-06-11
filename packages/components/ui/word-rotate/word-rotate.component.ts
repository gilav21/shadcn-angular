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
    class = input('');
    words = input<string[]>([]);
    duration = input(2000);

    currentIndex = signal(0);
    private intervalId: ReturnType<typeof setInterval> | null = null;

    classes = computed(() => cn(
        'relative inline-block overflow-hidden',
        this.class()
    ));

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
