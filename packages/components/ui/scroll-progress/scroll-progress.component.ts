import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    AfterViewInit,
    OnDestroy,
    NgZone,
    inject,
    ElementRef,
    ViewChild,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-scroll-progress',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './scroll-progress.component.html',
    host: { class: 'contents' },
})
export class ScrollProgressComponent implements AfterViewInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    @ViewChild('bar') barRef!: ElementRef<HTMLElement>;

    /** Extra classes merged onto the fixed full-width track — override `z-50` here if the bar is covered by (or covers) another overlay. */
    class = input('');
    /** Which viewport edge the bar is pinned to. Purely visual; it does not change which element is tracked. */
    position = input<'top' | 'bottom'>('top');
    /** Fill colour of the bar, applied as an inline `background-color`. Any CSS colour works, including `var(--…)` theme tokens (the default). Read once in `ngAfterViewInit`. */
    color = input('var(--primary)');
    /** Bar thickness in pixels, set inline on the fill element. Read once in `ngAfterViewInit` — later changes are not applied. */
    height = input(3);
    /**
     * Scroll source to track: an element, a CSS selector for one, or `null` to
     * auto-detect. Auto-detection walks up from the host looking for the first
     * ancestor with `overflow-y: auto | scroll` and falls back to the window.
     * An invalid or unmatched selector falls back the same way rather than
     * throwing. Resolved once in `ngAfterViewInit`.
     */
    container = input<string | HTMLElement | null>(null);

    classes = computed(() => cn(
        'fixed left-0 right-0 z-50 transition-none',
        this.position() === 'top' ? 'top-0' : 'bottom-0',
        this.class()
    ));

    private scrollTarget: HTMLElement | Window | null = null;

    private readonly scrollHandler = (): void => {
        let scrollTop: number;
        let scrollHeight: number;

        if (this.scrollTarget instanceof HTMLElement) {
            scrollTop = this.scrollTarget.scrollTop;
            scrollHeight = this.scrollTarget.scrollHeight - this.scrollTarget.clientHeight;
        } else {
            scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        }

        const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        const bar = this.barRef?.nativeElement;
        if (bar) {
            bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        }
    };

    ngAfterViewInit(): void {
        const bar = this.barRef.nativeElement;
        bar.style.height = `${this.height()}px`;
        bar.style.backgroundColor = this.color();

        const containerInput = this.container();
        if (containerInput instanceof HTMLElement) {
            this.scrollTarget = containerInput;
        } else if (typeof containerInput === 'string') {
            try {
                this.scrollTarget = document.querySelector<HTMLElement>(containerInput);
            } catch {
                this.scrollTarget = null;
            }
        }

        if (!this.scrollTarget) {
            const host = this.el.nativeElement as HTMLElement;
            let parent = host.parentElement;
            while (parent && parent !== document.body) {
                const style = getComputedStyle(parent);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                    this.scrollTarget = parent;
                    break;
                }
                parent = parent.parentElement;
            }
        }

        this.scrollTarget ??= this.el.nativeElement.ownerDocument.defaultView;

        if (!this.scrollTarget) {
            return;
        }

        this.ngZone.runOutsideAngular(() => {
            (this.scrollTarget as EventTarget).addEventListener('scroll', this.scrollHandler, { passive: true });
        });
        this.scrollHandler();
    }

    ngOnDestroy(): void {
        if (this.scrollTarget) {
            (this.scrollTarget as EventTarget).removeEventListener('scroll', this.scrollHandler);
        }
    }
}
