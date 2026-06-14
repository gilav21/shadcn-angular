import {
    Component,
    ChangeDetectionStrategy,
    input,
    model,
    computed,
    signal,
    viewChild,
    ElementRef,
    DestroyRef,
    inject,
    AfterViewInit,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { COMPARISON_SLIDER_LOCALES, type ComparisonSliderLocale } from './comparison-slider.locales';
import { onPointerDrag } from '../../lib/touch';

export type ComparisonSliderOrientation = 'horizontal' | 'vertical';

@Component({
    selector: 'ui-comparison-slider',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './comparison-slider.component.html',
    host: { class: 'contents' },
})
export class ComparisonSliderComponent implements AfterViewInit {
    readonly beforeSrc = input.required<string>();
    readonly afterSrc = input.required<string>();
    readonly beforeAlt = input<string>('');
    readonly afterAlt = input<string>('');
    readonly beforeLabel = input<string>();
    readonly afterLabel = input<string>();
    readonly position = model<number>(50);
    readonly orientation = input<ComparisonSliderOrientation>('horizontal');
    readonly class = input('');

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<ComparisonSliderLocale>>();
    private readonly i18n = createLocaleBindings(this.locale, COMPARISON_SLIDER_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;

    readonly rootRef = viewChild.required<ElementRef<HTMLDivElement>>('root');

    private readonly destroyRef = inject(DestroyRef);
    private readonly _rootWidth = signal(0);
    private readonly _rootHeight = signal(0);
    private dragCleanup: (() => void) | null = null;
    private resizeObserver: ResizeObserver | null = null;

    readonly rootWidth = this._rootWidth.asReadonly();
    readonly rootHeight = this._rootHeight.asReadonly();

    readonly isHorizontal = computed(() => this.orientation() === 'horizontal');

    readonly ariaValueText = computed(() => `${Math.round(this.position())}% before, ${Math.round(100 - this.position())}% after`);

    readonly classes = computed(() =>
        cn(
            'relative w-full overflow-hidden select-none aspect-video touch-none',
            this.class()
        )
    );

    readonly clipWrapperClass = computed(() =>
        cn(
            'absolute overflow-hidden',
            this.isHorizontal() ? 'inset-y-0 left-0' : 'inset-x-0 top-0'
        )
    );

    readonly dividerClass = computed(() =>
        cn(
            'absolute z-10 flex items-center justify-center pointer-events-none',
            this.isHorizontal()
                ? 'flex-col -translate-x-1/2 inset-y-0 w-1'
                : 'flex-row -translate-y-1/2 inset-x-0 h-1'
        )
    );

    readonly dividerLineClass = computed(() =>
        cn(
            'bg-white/90 shadow flex-1',
            this.isHorizontal() ? 'w-0.5' : 'h-0.5'
        )
    );

    readonly handleClass = computed(() =>
        cn(
            'pointer-events-auto z-20 flex items-center justify-center rounded-full bg-white shadow-md cursor-grab active:cursor-grabbing shrink-0',
            'w-10 h-10 border-2 border-white/80',
            'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
            'touch-none',
            this.isHorizontal() ? 'flex-row gap-0.5' : 'flex-col gap-0.5'
        )
    );

    ngAfterViewInit(): void {
        this.setupResizeObserver();
    }

    private setupResizeObserver(): void {
        const el = this.rootRef().nativeElement;
        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                this._rootWidth.set(entry.contentRect.width);
                this._rootHeight.set(entry.contentRect.height);
            }
        });
        this.resizeObserver.observe(el);
        this._rootWidth.set(el.clientWidth);
        this._rootHeight.set(el.clientHeight);

        this.destroyRef.onDestroy(() => {
            this.resizeObserver?.disconnect();
            this.dragCleanup?.();
        });
    }

    onTrackMouseDown(event: MouseEvent): void {
        this.startDrag(event.clientX, event.clientY);
    }

    onTrackTouchStart(event: TouchEvent): void {
        if (event.touches.length === 0) return;
        event.preventDefault();
        const touch = event.touches[0];
        this.startDrag(touch.clientX, touch.clientY);
    }

    onKeydown(event: KeyboardEvent): void {
        const delta = this.keyDelta(event.key);
        if (delta !== undefined) {
            event.preventDefault();
            this.position.set(this.clamp(this.position() + delta));
            return;
        }
        if (event.key === 'Home') {
            event.preventDefault();
            this.position.set(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            this.position.set(100);
        }
    }

    private keyDelta(key: string): number | undefined {
        const horizontal = this.isHorizontal();
        switch (key) {
            case 'ArrowLeft':
                return -1;
            case 'ArrowRight':
                return 1;
            case 'ArrowUp':
                return horizontal ? 1 : -1;
            case 'ArrowDown':
                return horizontal ? -1 : 1;
            default:
                return undefined;
        }
    }

    private startDrag(clientX: number, clientY: number): void {
        this.dragCleanup?.();
        this.position.set(this.positionFromPointer(clientX, clientY));
        this.dragCleanup = onPointerDrag(
            (x, y) => this.position.set(this.positionFromPointer(x, y)),
            () => { this.dragCleanup = null; }
        );
    }

    private positionFromPointer(clientX: number, clientY: number): number {
        const rect = this.rootRef().nativeElement.getBoundingClientRect();
        if (this.isHorizontal()) {
            return this.clamp(((clientX - rect.left) / rect.width) * 100);
        }
        return this.clamp(((clientY - rect.top) / rect.height) * 100);
    }

    private clamp(n: number): number {
        return Math.max(0, Math.min(100, n));
    }
}
