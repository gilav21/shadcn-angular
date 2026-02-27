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
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-scroll-progress',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="classes()" [attr.data-slot]="'scroll-progress'" #bar></div>
    `,
    host: { class: 'contents' },
})
export class ScrollProgressComponent implements AfterViewInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    @ViewChild('bar') barRef!: ElementRef<HTMLElement>;

    class = input('');
    position = input<'top' | 'bottom'>('top');
    color = input('var(--primary)');
    height = input(3);
    container = input<string | HTMLElement | null>(null);

    classes = computed(() => cn(
        'fixed left-0 right-0 z-50 transition-none',
        this.position() === 'top' ? 'top-0' : 'bottom-0',
        this.class()
    ));

    private scrollTarget: HTMLElement | Window | null = null;

    private readonly scrollHandler = () => {
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

    ngAfterViewInit() {
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

    ngOnDestroy() {
        if (this.scrollTarget) {
            (this.scrollTarget as EventTarget).removeEventListener('scroll', this.scrollHandler);
        }
    }
}
