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
    selector: 'ui-morphing-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <span [class]="classes()" [attr.data-slot]="'morphing-text'">
            <span
                class="absolute inset-0 flex items-center justify-center transition-all"
                [style.transition-duration]="transitionDuration()"
                [class]="currentVisible() ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'"
            >{{ currentText() }}</span>
            <span
                class="absolute inset-0 flex items-center justify-center transition-all"
                [style.transition-duration]="transitionDuration()"
                [class]="currentVisible() ? 'opacity-0 blur-sm' : 'opacity-100 blur-0'"
            >{{ nextText() }}</span>
            <span class="invisible">{{ longestText() }}</span>
        </span>
    `,
    styles: [`
        @media (prefers-reduced-motion: reduce) {
            :host span {
                transition: none !important;
                filter: none !important;
            }
        }
    `],
    host: { class: 'contents' },
})
export class MorphingTextComponent implements OnInit, OnDestroy {
    class = input('');
    texts = input<string[]>([]);
    interval = input(3000);

    private textIndex = signal(0);
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
