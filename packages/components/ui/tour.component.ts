import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    model,
    effect,
    inject,
    DestroyRef,
    ElementRef,
    viewChild,
    NgZone,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn, prefersReducedMotion, isRtl } from '../lib/utils';
import { ButtonComponent } from './button.component';

export interface TourStep {
    target: string;
    title: string;
    description?: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
}

type TourSide = 'top' | 'bottom' | 'left' | 'right';

interface Rect {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
    readonly bottom: number;
    readonly right: number;
}

interface Position {
    readonly top: number;
    readonly left: number;
}

interface CardSize {
    readonly width: number;
    readonly height: number;
}

const CARD_GAP = 12;
const SPOTLIGHT_PAD = 4;
const VIEWPORT_MARGIN = 8;
const ESTIMATED_CARD_HEIGHT = 160;
const CARD_WIDTH = 320;

function chooseSide(targetRect: Rect, cardSize: CardSize, preferred: TourSide | undefined): TourSide {
    const vp = {
        width: globalThis.window?.innerWidth ?? 0,
        height: globalThis.window?.innerHeight ?? 0,
    };
    const below = vp.height - targetRect.bottom;
    const above = targetRect.top;
    const right = vp.width - targetRect.right;
    const left = targetRect.left;

    if (preferred) return preferred;
    if (below >= cardSize.height + CARD_GAP) return 'bottom';
    if (above >= cardSize.height + CARD_GAP) return 'top';
    if (right >= cardSize.width + CARD_GAP) return 'right';
    if (left >= cardSize.width + CARD_GAP) return 'left';
    return 'bottom';
}

function placeCard(side: TourSide, targetRect: Rect, cardSize: CardSize): Position {
    const cx = targetRect.left + targetRect.width / 2;
    const cy = targetRect.top + targetRect.height / 2;

    switch (side) {
        case 'bottom':
            return { top: targetRect.bottom + CARD_GAP, left: cx - cardSize.width / 2 };
        case 'top':
            return { top: targetRect.top - cardSize.height - CARD_GAP, left: cx - cardSize.width / 2 };
        case 'right':
            return { top: cy - cardSize.height / 2, left: targetRect.right + CARD_GAP };
        case 'left':
            return { top: cy - cardSize.height / 2, left: targetRect.left - cardSize.width - CARD_GAP };
    }
}

function clampToViewport(pos: Position, cardSize: CardSize): Position {
    const vw = globalThis.window?.innerWidth ?? 0;
    const vh = globalThis.window?.innerHeight ?? 0;
    return {
        top: Math.max(VIEWPORT_MARGIN, Math.min(vh - cardSize.height - VIEWPORT_MARGIN, pos.top)),
        left: Math.max(VIEWPORT_MARGIN, Math.min(vw - cardSize.width - VIEWPORT_MARGIN, pos.left)),
    };
}

function computeCardPos(targetRect: Rect, cardSize: CardSize, preferred: TourSide | undefined): Position {
    const side = chooseSide(targetRect, cardSize, preferred);
    const raw = placeCard(side, targetRect, cardSize);
    return clampToViewport(raw, cardSize);
}

@Component({
    selector: 'ui-tour',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    template: `
        @if (active() && currentStep()) {
            <div
                class="fixed rounded-md pointer-events-none transition-all duration-200"
                [style.top.px]="spotlightRect().top"
                [style.left.px]="spotlightRect().left"
                [style.width.px]="spotlightRect().width"
                [style.height.px]="spotlightRect().height"
                style="z-index:9999;box-shadow:0 0 0 9999px rgba(0,0,0,0.6);"
                [attr.data-slot]="'tour-spotlight'"
            ></div>
            <div
                class="fixed w-80 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none"
                [style.top.px]="cardPos().top"
                [style.left.px]="cardPos().left"
                style="z-index:10000;"
                [attr.data-slot]="'tour-card'"
                tabindex="-1"
                #cardEl
                (keydown)="onKeydown($event)"
            >
                <div class="text-xs text-muted-foreground mb-1">{{ currentIndex() + 1 }} / {{ steps().length }}</div>
                <h3 class="font-semibold">{{ currentStep()!.title }}</h3>
                @if (currentStep()!.description) {
                    <p class="text-sm text-muted-foreground mt-1">{{ currentStep()!.description }}</p>
                }
                <div class="flex flex-wrap gap-2 mt-4 justify-end">
                    @if (showSkip() && !isLastStep()) {
                        <ui-button variant="ghost" size="sm" (click)="skip()">{{ skipLabel() }}</ui-button>
                    }
                    @if (currentIndex() > 0) {
                        <ui-button variant="outline" size="sm" (click)="previous()">{{ isRtlLayout() ? nextLabel() : prevLabel() }}</ui-button>
                    }
                    <ui-button size="sm" (click)="next()">{{ isLastStep() ? finishLabel() : (isRtlLayout() ? prevLabel() : nextLabel()) }}</ui-button>
                </div>
            </div>
        }
    `,
    host: { class: 'contents' },
})
export class TourComponent {
    private readonly document = inject(DOCUMENT);
    private readonly destroyRef = inject(DestroyRef);
    private readonly zone = inject(NgZone);
    private readonly hostEl = inject(ElementRef<HTMLElement>);

    readonly steps = input<TourStep[]>([]);
    readonly active = model<boolean>(false);
    readonly showSkip = input<boolean>(true);
    readonly nextLabel = input<string>('Next');
    readonly prevLabel = input<string>('Previous');
    readonly finishLabel = input<string>('Done');
    readonly skipLabel = input<string>('Skip');
    readonly class = input('');

    readonly done = output<void>();
    readonly stepChange = output<number>();

    private readonly cardElRef = viewChild<ElementRef<HTMLDivElement>>('cardEl');

    private readonly _currentIndex = signal(0);
    readonly currentIndex = this._currentIndex.asReadonly();

    private readonly _targetRect = signal<Rect>({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 });
    private readonly _cardSize = signal<CardSize>({ width: CARD_WIDTH, height: ESTIMATED_CARD_HEIGHT });

    readonly currentStep = computed(() => {
        const s = this.steps();
        const i = this._currentIndex();
        return s[i] ?? null;
    });

    readonly isLastStep = computed(() => this._currentIndex() === this.steps().length - 1);

    readonly isRtlLayout = computed(() => isRtl(this.hostEl.nativeElement));

    readonly spotlightRect = computed(() => {
        const r = this._targetRect();
        return {
            top: r.top - SPOTLIGHT_PAD,
            left: r.left - SPOTLIGHT_PAD,
            width: r.width + SPOTLIGHT_PAD * 2,
            height: r.height + SPOTLIGHT_PAD * 2,
        };
    });

    readonly cardPos = computed(() =>
        computeCardPos(this._targetRect(), this._cardSize(), this.currentStep()?.side)
    );

    readonly classes = computed(() => cn(this.class()));

    private resizeObserver: ResizeObserver | null = null;
    private removeScrollListener: (() => void) | null = null;
    private removeResizeListener: (() => void) | null = null;

    constructor() {
        effect(() => {
            const isActive = this.active();
            if (isActive) {
                this._currentIndex.set(0);
                this.goToStep(0);
            } else {
                this.teardown();
            }
        });

        this.destroyRef.onDestroy(() => this.teardown());
    }

    next(): void {
        if (this.isLastStep()) {
            this.finish();
            return;
        }
        this.goToStep(this._currentIndex() + 1);
    }

    previous(): void {
        if (this._currentIndex() <= 0) return;
        this.goToStep(this._currentIndex() - 1);
    }

    skip(): void {
        this.active.set(false);
        this.done.emit();
    }

    onKeydown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'ArrowRight':
            case 'Enter':
                event.preventDefault();
                this.next();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.previous();
                break;
            case 'Escape':
                event.preventDefault();
                this.skip();
                break;
        }
    }

    private finish(): void {
        this.active.set(false);
        this.done.emit();
    }

    private goToStep(index: number): void {
        const steps = this.steps();
        if (steps.length === 0) return;

        const safeIndex = this.findNextValidStep(index, index);
        if (safeIndex === -1) {
            this.finish();
            return;
        }

        this._currentIndex.set(safeIndex);
        this.stepChange.emit(safeIndex);
        this.updatePosition();
    }

    private findNextValidStep(startIndex: number, originalIndex: number): number {
        const steps = this.steps();
        let idx = startIndex;
        let attempts = 0;

        while (attempts < steps.length) {
            if (idx >= steps.length) idx = 0;
            const step = steps[idx];
            if (step && this.document.querySelector(step.target)) return idx;
            idx++;
            attempts++;
            if (idx === originalIndex && attempts > 0) break;
        }
        return -1;
    }

    private updatePosition(): void {
        const step = this.steps()[this._currentIndex()];
        if (!step) return;

        const targetEl = this.document.querySelector<HTMLElement>(step.target);
        if (!targetEl) return;

        targetEl.scrollIntoView({
            block: 'center',
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });

        this.teardownObservers();
        this.setupObservers(targetEl);
        this.readAndSetRect(targetEl);

        requestAnimationFrame(() => {
            this.readAndSetRect(targetEl);
            setTimeout(() => {
                this.measureCard();
                this.focusCard();
            }, 0);
        });
    }

    private readAndSetRect(targetEl: HTMLElement): void {
        const r = targetEl.getBoundingClientRect();
        this._targetRect.set({
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
            right: r.right,
        });
    }

    private measureCard(): void {
        const cardEl = this.cardElRef()?.nativeElement;
        if (!cardEl) return;
        this._cardSize.set({
            width: cardEl.offsetWidth || CARD_WIDTH,
            height: cardEl.offsetHeight || ESTIMATED_CARD_HEIGHT,
        });
    }

    private focusCard(): void {
        const cardEl = this.cardElRef()?.nativeElement;
        cardEl?.focus();
    }

    private setupObservers(targetEl: HTMLElement): void {
        this.zone.runOutsideAngular(() => {
            const onReposition = () => {
                this.zone.run(() => this.readAndSetRect(targetEl));
            };

            this.resizeObserver = new ResizeObserver(onReposition);
            this.resizeObserver.observe(targetEl);

            globalThis.window?.addEventListener('scroll', onReposition, { passive: true, capture: true });
            globalThis.window?.addEventListener('resize', onReposition, { passive: true });

            this.removeScrollListener = () => {
                globalThis.window?.removeEventListener('scroll', onReposition, { capture: true });
            };
            this.removeResizeListener = () => {
                globalThis.window?.removeEventListener('resize', onReposition);
            };
        });
    }

    private teardownObservers(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.removeScrollListener?.();
        this.removeScrollListener = null;
        this.removeResizeListener?.();
        this.removeResizeListener = null;
    }

    private teardown(): void {
        this.teardownObservers();
    }
}
