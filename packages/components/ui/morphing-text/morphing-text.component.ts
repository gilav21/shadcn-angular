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
    class = input('');
    texts = input<string[]>([]);
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

    ngOnInit() {
        if (prefersReducedMotion() || this.texts().length <= 1) return;

        const halfInterval = this.interval() / 2;
        this.intervalId = setInterval(() => {
            this.currentVisible.update(v => !v);
            if (this.currentVisible()) {
                this.textIndex.update(i => (i + 1) % this.texts().length);
            }
        }, halfInterval);
    }

    ngOnDestroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
