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
    afterNextRender,
    untracked,
    Injector,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../../lib/utils';
import { ButtonComponent } from '../button';

/**
 * One step of a guided tour.
 *
 * - `target` is a CSS selector resolved at the moment the step activates.
 *   If no matching element exists, the tour logs a console warning and
 *   skips forward to the next step.
 * - `title` and `description` populate the tooltip card.
 * - `side` forces tooltip placement; when omitted, the tour picks the
 *   side with the most available viewport room.
 */
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
const SPOTLIGHT_PAD = 6;
const VIEWPORT_MARGIN = 8;
const DEFAULT_CARD_WIDTH = 320;
const DEFAULT_CARD_HEIGHT = 160;
const TOUR_HIGHLIGHT_ATTR = 'data-ui-tour-highlight';

interface HighlightSavedStyles {
    readonly outline: string;
    readonly outlineOffset: string;
    readonly position: string;
    readonly zIndex: string;
    readonly borderRadius: string;
    readonly transition: string;
}

function chooseSide(targetRect: Rect, cardSize: CardSize, preferred: TourSide | undefined): TourSide {
    if (preferred) return preferred;
    const vw = globalThis.window?.innerWidth ?? 0;
    const vh = globalThis.window?.innerHeight ?? 0;
    const below = vh - targetRect.bottom;
    const above = targetRect.top;
    const right = vw - targetRect.right;
    const left = targetRect.left;

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
    templateUrl: './tour.component.html',
    host: { class: 'contents' },
})
/**
 * Declarative guided tour with a spotlight overlay and a positioned step card.
 *
 * Set `[steps]` and toggle `[(active)]` to start the tour. Each step's target
 * is resolved via `document.querySelector`; missing targets are skipped with
 * a console warning. The tour scrolls the target into view, places the card
 * on the side with the most room (overridable per step), and applies a
 * `.ui-tour-target-highlight` outline class to the active element.
 *
 * @example
 * ```html
 * <ui-tour
 *   [steps]="[
 *     { target: '#save', title: 'Save', description: 'Saves your work.' },
 *     { target: '#sidebar', title: 'Sidebar', description: 'Navigate here.' }
 *   ]"
 *   [(active)]="showTour"
 *   (done)="showTour = false"
 * />
 * ```
 */
export class TourComponent {
    private readonly document = inject(DOCUMENT);
    private readonly destroyRef = inject(DestroyRef);
    private readonly zone = inject(NgZone);
    private readonly injector = inject(Injector);

    /** Steps shown in order. Missing-target steps are skipped with a warning. */
    readonly steps = input<TourStep[]>([]);
    /** Two-way activation flag. Setting to `false` cancels the tour without emitting `done`. */
    readonly active = model<boolean>(false);
    /** Whether the Skip button is shown on intermediate steps. */
    readonly showSkip = input<boolean>(true);
    /** Label for the forward button on non-final steps. */
    readonly nextLabel = input<string>('Next');
    /** Label for the back button on non-first steps. */
    readonly prevLabel = input<string>('Previous');
    /** Label for the forward button on the final step. */
    readonly finishLabel = input<string>('Done');
    /** Label for the skip button. */
    readonly skipLabel = input<string>('Skip');
    /** Extra CSS classes applied to the floating step card. */
    readonly class = input('');

    /** Emitted when the tour finishes naturally or is skipped. Not emitted when the parent flips `active` off externally. */
    readonly done = output<void>();
    /** Emitted whenever the visible step index changes. */
    readonly stepChange = output<number>();

    private readonly cardElRef = viewChild<ElementRef<HTMLDivElement>>('cardEl');

    private readonly _currentIndex = signal(0);
    readonly currentIndex = this._currentIndex.asReadonly();

    private readonly _targetRect = signal<Rect>({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 });
    private readonly _cardSize = signal<CardSize>({ width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT });
    private readonly _isReady = signal(false);
    readonly isReady = this._isReady.asReadonly();

    readonly currentStep = computed(() => {
        const s = this.steps();
        const i = this._currentIndex();
        return s[i] ?? null;
    });

    readonly isLastStep = computed(() => this._currentIndex() === this.steps().length - 1);

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

    readonly cardClasses = computed(() =>
        cn(
            'fixed w-80 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
            this.class()
        )
    );

    private resizeObserver: ResizeObserver | null = null;
    private removeReposition: (() => void) | null = null;
    private currentTargetEl: HTMLElement | null = null;
    private savedTargetStyles: HighlightSavedStyles | null = null;

    private wasActive = false;

    constructor() {
        effect(() => {
            const isActive = this.active();
            untracked(() => {
                if (isActive && !this.wasActive) {
                    this.wasActive = true;
                    this.goToStep(0);
                } else if (!isActive && this.wasActive) {
                    this.wasActive = false;
                    this.teardown();
                }
            });
        });

        this.destroyRef.onDestroy(() => {
            this.wasActive = false;
            this.teardown();
        });
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
        if (this.steps().length === 0) return;

        this._isReady.set(false);
        this.clearCurrentHighlight();
        this.setupPositionForStep(index);
    }

    private resolveTarget(startIndex: number): { targetEl: HTMLElement; finalIndex: number } | null {
        const steps = this.steps();
        let idx = startIndex;
        while (idx < steps.length) {
            const step = steps[idx];
            if (step) {
                const el = this.document.querySelector<HTMLElement>(step.target);
                if (el) return { targetEl: el, finalIndex: idx };
                globalThis.console?.warn(`[ui-tour] target not found: "${step.target}" — skipping step.`);
            }
            idx++;
        }
        return null;
    }

    private setupPositionForStep(index: number): void {
        const resolved = this.resolveTarget(index);
        if (!resolved) {
            this.finish();
            return;
        }
        const { targetEl, finalIndex } = resolved;
        this._currentIndex.set(finalIndex);
        this.stepChange.emit(finalIndex);

        this.teardownObservers();
        this.applyHighlight(targetEl);
        this.currentTargetEl = targetEl;

        targetEl.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
        this.readAndSetRect(targetEl);
        this.setupObservers(targetEl);

        afterNextRender(
            () => {
                this.readAndSetRect(targetEl);
                this.measureCard();
                this._isReady.set(true);
                afterNextRender(
                    () => this.focusCard(),
                    { injector: this.injector }
                );
            },
            { injector: this.injector }
        );
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
        const width = cardEl.offsetWidth || DEFAULT_CARD_WIDTH;
        const height = cardEl.offsetHeight || DEFAULT_CARD_HEIGHT;
        if (width === this._cardSize().width && height === this._cardSize().height) return;
        this._cardSize.set({ width, height });
    }

    private focusCard(): void {
        const cardEl = this.cardElRef()?.nativeElement;
        cardEl?.focus({ preventScroll: true });
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

            this.removeReposition = () => {
                globalThis.window?.removeEventListener('scroll', onReposition, { capture: true });
                globalThis.window?.removeEventListener('resize', onReposition);
            };
        });
    }

    private teardownObservers(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.removeReposition?.();
        this.removeReposition = null;
    }

    private teardown(): void {
        this.teardownObservers();
        this.clearCurrentHighlight();
        this._isReady.set(false);
    }

    private applyHighlight(targetEl: HTMLElement): void {
        this.savedTargetStyles = {
            outline: targetEl.style.outline,
            outlineOffset: targetEl.style.outlineOffset,
            position: targetEl.style.position,
            zIndex: targetEl.style.zIndex,
            borderRadius: targetEl.style.borderRadius,
            transition: targetEl.style.transition,
        };
        targetEl.setAttribute(TOUR_HIGHLIGHT_ATTR, '');
        const computedPosition = globalThis.window?.getComputedStyle(targetEl).position;
        if (computedPosition === 'static' || !computedPosition) {
            targetEl.style.position = 'relative';
        }
        targetEl.style.zIndex = '10001';
        targetEl.style.outline = '2px solid var(--ring, #0ea5e9)';
        targetEl.style.outlineOffset = '4px';
        targetEl.style.borderRadius = '6px';
        targetEl.style.transition = 'outline 0.15s ease';
    }

    private clearCurrentHighlight(): void {
        const el = this.currentTargetEl;
        const saved = this.savedTargetStyles;
        if (el && saved) {
            el.style.outline = saved.outline;
            el.style.outlineOffset = saved.outlineOffset;
            el.style.position = saved.position;
            el.style.zIndex = saved.zIndex;
            el.style.borderRadius = saved.borderRadius;
            el.style.transition = saved.transition;
            el.removeAttribute(TOUR_HIGHLIGHT_ATTR);
        }
        this.currentTargetEl = null;
        this.savedTargetStyles = null;
    }
}
