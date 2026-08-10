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
    /** Source of the "before" image — the clipped layer on the start side of the divider. Both images should share the same dimensions, or they will not line up under the reveal. */
    readonly beforeSrc = input.required<string>();
    /** Source of the "after" image, drawn underneath and revealed as the divider moves. */
    readonly afterSrc = input.required<string>();
    /** Alt text for the before image. Leave empty only when the pair is purely decorative — the two images are separate elements to assistive tech. */
    readonly beforeAlt = input<string>('');
    /** Alt text for the after image. */
    readonly afterAlt = input<string>('');
    /** Caption badge pinned to the top-start corner (e.g. "Original"). Omitted entirely when unset — there is no default text. */
    readonly beforeLabel = input<string>();
    /** Caption badge pinned to the top-end corner (e.g. "Edited"). Omitted entirely when unset; it truncates rather than wrapping on narrow screens. */
    readonly afterLabel = input<string>();
    /**
     * Divider position as a percentage from the start edge (left, or top when
     * vertical), 0–100. Two-way: dragging, tapping the track and the arrow keys
     * all write back to it, and it is always clamped into range.
     */
    readonly position = model<number>(50);
    /** Split axis: `'horizontal'` wipes left-to-right, `'vertical'` top-to-bottom. Also swaps which arrow keys nudge the divider. */
    readonly orientation = input<ComparisonSliderOrientation>('horizontal');
    /** Extra classes merged onto the root. It is `aspect-video` by default — override that to match your images' ratio, since both layers are absolutely positioned inside it. */
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

    /** Mouse handler on the whole track: jumps the divider to the click point, then follows the pointer until release — so a click anywhere is also the start of a drag. */
    onTrackMouseDown(event: MouseEvent): void {
        this.startDrag(event.clientX, event.clientY);
    }

    /**
     * Touch equivalent of {@link onTrackMouseDown}, tracking the first touch
     * point. The default is prevented so dragging the divider does not scroll the
     * page; additional simultaneous touches are ignored.
     */
    onTrackTouchStart(event: TouchEvent): void {
        if (event.touches.length === 0) return;
        event.preventDefault();
        const touch = event.touches[0];
        this.startDrag(touch.clientX, touch.clientY);
    }

    /**
     * Keyboard control from the handle: arrows nudge by 1%, Home and End jump to
     * the extremes. Which arrows move the divider follows {@link orientation} —
     * Left/Right always decrease/increase it, while Up/Down are inverted between
     * the two orientations, so Up moves towards the top when vertical and acts
     * like Right when horizontal. Every handled key is `preventDefault`ed to stop
     * the page scrolling.
     */
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
