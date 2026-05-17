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
import { cn } from '../lib/utils';
import { onPointerDrag } from '../lib/touch';

export type ComparisonSliderOrientation = 'horizontal' | 'vertical';

@Component({
    selector: 'ui-comparison-slider',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div
            #root
            [class]="classes()"
            [attr.data-slot]="'comparison-slider'"
            (mousedown)="onTrackMouseDown($event)"
            (touchstart)="onTrackTouchStart($event)"
        >
            <img
                [src]="afterSrc()"
                [alt]="afterAlt()"
                class="absolute inset-0 w-full h-full object-cover block"
                draggable="false"
            />

            <div
                [class]="clipWrapperClass()"
                [style.width.%]="isHorizontal() ? position() : null"
                [style.height.%]="isHorizontal() ? null : position()"
                style="overflow: hidden;"
            >
                <div [style.width.px]="isHorizontal() ? rootWidth() : null" [style.height.px]="isHorizontal() ? null : rootHeight()" class="absolute top-0 left-0" [class.h-full]="isHorizontal()" [class.w-full]="!isHorizontal()">
                    <img
                        [src]="beforeSrc()"
                        [alt]="beforeAlt()"
                        class="absolute top-0 left-0 object-cover block w-full h-full"
                        draggable="false"
                    />
                </div>
            </div>

            <div [class]="dividerClass()" [style.left.%]="isHorizontal() ? position() : null" [style.top.%]="isHorizontal() ? null : position()">
                <div [class]="dividerLineClass()"></div>
                <button
                    #handle
                    type="button"
                    role="slider"
                    tabindex="0"
                    aria-label="Comparison slider"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-valuenow]="position()"
                    [attr.aria-valuetext]="ariaValueText()"
                    [attr.aria-orientation]="orientation()"
                    [class]="handleClass()"
                    (keydown)="onKeydown($event)"
                >
                    @if (isHorizontal()) {
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                    } @else {
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                    }
                </button>
                <div [class]="dividerLineClass()"></div>
            </div>

            @if (beforeLabel()) {
                <span class="absolute top-2 left-2 text-xs bg-black/60 text-white rounded px-2 py-1 max-w-[120px] sm:max-w-[200px] truncate pointer-events-none z-20">
                    {{ beforeLabel() }}
                </span>
            }

            @if (afterLabel()) {
                <span class="absolute top-2 right-2 text-xs bg-black/60 text-white rounded px-2 py-1 max-w-[120px] sm:max-w-[200px] truncate pointer-events-none z-20">
                    {{ afterLabel() }}
                </span>
            }
        </div>
    `,
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
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
