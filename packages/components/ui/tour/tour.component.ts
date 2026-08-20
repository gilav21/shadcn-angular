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
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { COMMON_LOCALES, type CommonLocale } from '../../lib/i18n/common.locales';
import { ButtonComponent } from '../button';
import { readTourCompleted, writeTourCompleted } from './tour.utils';

type TourSide = 'top' | 'bottom' | 'left' | 'right';

/** Which way the tour is travelling when a step's hooks run. */
export type TourDirection = 'initial' | 'forward' | 'backward';

/** Why the tour ended — payload of the `done` output. */
export type TourEndReason = 'finished' | 'skipped';

/** Why a step was passed over — payload of the `stepSkipped` output. */
export type TourSkipReason = 'condition' | 'missing-target' | 'hook-error';

/** Details of a step the tour passed over instead of showing. */
export interface TourSkippedEvent {
    readonly index: number;
    readonly reason: TourSkipReason;
}

/**
 * Passed to every step hook.
 *
 * `signal` aborts when the user moves on or closes the tour while the hook is
 * still running — pass it to `fetch` and bail early from long work.
 */
export interface TourStepContext {
    readonly index: number;
    readonly direction: TourDirection;
    readonly signal: AbortSignal;
}

/**
 * One step of a guided tour.
 *
 * - `target` is a CSS selector resolved at the moment the step activates.
 *   If no matching element exists (or it is not rendered), the tour logs a
 *   console warning, emits `stepSkipped`, and moves on in the direction of
 *   travel.
 * - `title` and `description` populate the tooltip card.
 * - `side` forces tooltip placement; when omitted, the tour picks the
 *   side with the most available viewport room.
 */
export interface TourStep {
    target: string;
    title: string;
    description?: string;
    side?: TourSide;
    /**
     * Awaited before `target` is resolved and highlighted. Use it to put the
     * app into the state the step describes — open a panel, navigate to a
     * route, load a record. Pair it with `targetTimeout` so the tour waits for
     * the element the navigation renders.
     */
    beforeActivate?: (ctx: TourStepContext) => void | Promise<void>;
    /**
     * Awaited when leaving this step, before the next step's `beforeActivate`.
     * The undo of `beforeActivate` — close the panel, navigate back.
     * `ctx.direction` says which way the user is going.
     */
    afterDeactivate?: (ctx: TourStepContext) => void | Promise<void>;
    /** Include this step only when the predicate resolves truthy. */
    when?: (ctx: TourStepContext) => boolean | Promise<boolean>;
    /** Milliseconds to wait for `target` to appear. Overrides the component's `targetTimeout`. */
    targetTimeout?: number;
    /**
     * Branch instead of falling through to the next step. Consulted by
     * `next()` only — see {@link TourBranch}.
     */
    next?: TourBranch;
}

/**
 * Per-step branching predicate. Return the **index** of the step to go to
 * next, or `null` to end the tour there. Returning an out-of-range index — or
 * throwing — falls back to the default "advance by one" behaviour, so a broken
 * predicate cannot strand the user.
 *
 * It runs synchronously, before any of the target step's async hooks.
 *
 * @example
 * ```ts
 * { target: '#plan', title: 'Your plan', next: () => this.isPro() ? 4 : 2 }
 * ```
 */
export type TourBranch = (ctx: TourStepContext) => number | null;

interface ResolvedStep {
    readonly el: HTMLElement;
    readonly index: number;
}

/** Branch predicates never see a live abort signal — they are consulted synchronously and return at once. */
function branchContext(index: number): TourStepContext {
    return { index, direction: 'forward', signal: new AbortController().signal };
}

function hasHooks(step: TourStep): boolean {
    return !!step.when || !!step.beforeActivate || !!step.afterDeactivate || (step.targetTimeout ?? 0) > 0;
}

function isRendered(el: HTMLElement): boolean {
    const view = el.ownerDocument?.defaultView;
    if (!view) return true;
    let node: HTMLElement | null = el;
    while (node) {
        const style = view.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        node = node.parentElement;
    }
    return true;
}

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
 * is resolved via `document.querySelector`; targets that are missing or not
 * rendered are skipped in the direction of travel with a console warning and
 * a `stepSkipped` emission. The tour scrolls the target into view, places the
 * card on the side with the most room (overridable per step), and outlines the
 * active element.
 *
 * Steps may carry async hooks (`beforeActivate`, `afterDeactivate`, `when`) to
 * drive the app into the state they describe. Set `targetTimeout` so the tour
 * waits for elements those hooks render.
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
 *
 * @example Async step that opens a panel before highlighting inside it.
 * ```ts
 * steps: TourStep[] = [
 *   {
 *     target: '#panel-item',
 *     title: 'Your items',
 *     targetTimeout: 2000,
 *     beforeActivate: () => this.panel.open(),
 *     afterDeactivate: ({ direction }) => {
 *       if (direction === 'backward') this.panel.close();
 *     },
 *     when: () => this.items().length > 0,
 *   },
 * ];
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
    /**
     * Milliseconds to wait for a step's target to appear in the DOM before
     * giving up and skipping the step. `0` (the default) resolves targets
     * once, synchronously. Raise it for steps whose `beforeActivate` navigates
     * or loads data; per-step `targetTimeout` overrides this.
     */
    readonly targetTimeout = input<number>(0);
    /** Override for the forward button label on non-final steps. Falls back to `t().next`. */
    readonly nextLabel = input<string>();
    /** Override for the back button label on non-first steps. Falls back to `t().previous`. */
    readonly prevLabel = input<string>();
    /** Override for the forward button label on the final step. Falls back to `t().finish`. */
    readonly finishLabel = input<string>();
    /** Override for the skip button label. Falls back to `t().skip`. */
    readonly skipLabel = input<string>();

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<CommonLocale>>();
    private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
    protected readonly t = this.i18n.t;
    /** `'rtl'` when the active locale is RTL, otherwise `null` — bind to `[attr.dir]`. */
    readonly dir = this.i18n.dir;

    /** Extra CSS classes applied to the floating step card. */
    readonly class = input('');

    /**
     * Persist "this tour is done" under this key so it does not replay on every
     * visit. `null` (the default) keeps the component stateless — flip `active`
     * yourself and persist however you like; the `done` output still fires either
     * way, so an existing consumer's own store keeps working unchanged.
     *
     * When set, the flag is written on **both** endings (`finished` and
     * `skipped`) — a user who dismissed the tour does not want it again either —
     * and a tour whose flag is already set refuses to start: setting `active` to
     * `true` immediately flips it back to `false` without emitting `done`.
     *
     * Storage is best-effort. In private modes or sandboxed frames where
     * `localStorage` throws, reads return `false` and writes are swallowed, so
     * the tour simply behaves as if it had no key.
     *
     * Call {@link resetCompletion} to let it run again, and bump the key
     * (`'onboarding-v2'`) when the tour's content changes.
     */
    readonly storageKey = input<string | null>(null);

    /**
     * Emitted when the tour finishes naturally or is skipped, with the reason.
     * Not emitted when the parent flips `active` off externally.
     */
    readonly done = output<TourEndReason>();
    /** Emitted whenever a step is activated, with its index. */
    readonly stepChange = output<number>();
    /** Emitted for each step the tour passes over instead of showing. */
    readonly stepSkipped = output<TourSkippedEvent>();

    private readonly cardElRef = viewChild<ElementRef<HTMLDivElement>>('cardEl');

    private readonly _currentIndex = signal(0);
    readonly currentIndex = this._currentIndex.asReadonly();

    private readonly _targetRect = signal<Rect>({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 });
    private readonly _cardSize = signal<CardSize>({ width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT });
    private readonly _isReady = signal(false);
    readonly isReady = this._isReady.asReadonly();

    private readonly _isPending = signal(false);
    /** `true` while a step's async hooks run or its target is being waited for. */
    readonly isPending = this._isPending.asReadonly();

    /**
     * Steps this run has already proven unreachable. A step only lands here
     * after the tour actually tried it, so the UI can stop offering it —
     * otherwise the user sees a Back button that does nothing and a counter
     * that promises steps they can never reach.
     */
    private readonly _unreachable = signal<ReadonlySet<number>>(new Set());

    readonly currentStep = computed(() => {
        const s = this.steps();
        const i = this._currentIndex();
        return s[i] ?? null;
    });

    /** `false` when every earlier step is known unreachable — hide the Back button. */
    readonly canGoBack = computed(() => {
        const unreachable = this._unreachable();
        for (let i = this._currentIndex() - 1; i >= 0; i--) {
            if (!unreachable.has(i)) return true;
        }
        return false;
    });

    readonly isLastStep = computed(() => {
        const unreachable = this._unreachable();
        const total = this.steps().length;
        for (let i = this._currentIndex() + 1; i < total; i++) {
            if (!unreachable.has(i)) return false;
        }
        return true;
    });

    /** Total steps the user can actually reach, excluding ones proven unreachable. */
    readonly reachableCount = computed(() => this.steps().length - this._unreachable().size);

    /** 1-based position of the current step among the reachable ones. */
    readonly reachablePosition = computed(() => {
        const unreachable = this._unreachable();
        let position = 0;
        for (let i = 0; i <= this._currentIndex(); i++) {
            if (!unreachable.has(i)) position++;
        }
        return position;
    });

    /**
     * Tours without hooks or a wait budget resolve their steps synchronously,
     * so a click lands on the next step in the same tick — no microtask gap,
     * no card flicker.
     */
    private readonly hasAsyncSteps = computed(() => this.targetTimeout() > 0 || this.steps().some(hasHooks));

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
    /**
     * Whether this run ever put a step on screen.
     *
     * `finish('finished')` is not only the happy ending — it is also the
     * degenerate exit `commitOrFinish` takes when no step resolves at all.
     * Writing the completion flag there would permanently burn it for a
     * consumer whose anchors simply had not rendered yet (an async route, data
     * still loading), with no user-reachable recovery. So persistence is gated
     * on the tour having actually shown something.
     *
     * A tour that DID show a step and then had `steps` emptied under it still
     * records completion — it ran, so far as the user is concerned.
     */
    private showedAStep = false;
    private lastStepsLength = -1;
    private runToken = 0;
    private abortController: AbortController | null = null;

    constructor() {
        effect(() => {
            const isActive = this.active();
            untracked(() => {
                if (isActive && !this.wasActive) {
                    if (this.isCompleted()) {
                        this.active.set(false);
                        return;
                    }
                    this.wasActive = true;
                    this.showedAStep = false;
                    this.transition(0, 'initial');
                } else if (!isActive && this.wasActive) {
                    this.wasActive = false;
                    this.teardown();
                }
            });
        });

        effect(() => {
            const length = this.steps().length;
            untracked(() => this.reconcileStepsLength(length));
        });

        this.destroyRef.onDestroy(() => {
            this.wasActive = false;
            this.teardown();
        });
    }

    /**
     * Advances to the next resolvable step, or ends the tour with
     * `done('finished')` when already on the last one. Ignored while a step's
     * async hooks are still running (`isPending`), so double-clicking the button
     * cannot skip a step.
     */
    next(): void {
        if (this._isPending()) return;

        const branched = this.resolveBranch();
        if (branched !== undefined) {
            if (branched === null) {
                this.finish('finished');
                return;
            }
            this.transition(branched, branched < this._currentIndex() ? 'backward' : 'forward');
            return;
        }

        if (this.isLastStep()) {
            this.finish('finished');
            return;
        }
        this.transition(this._currentIndex() + 1, 'forward');
    }

    /**
     * Ask the current step's `next` predicate where to go. `undefined` means
     * "no branch — use the default", `null` means "end here", a number is the
     * target index. An out-of-range answer or a throw degrades to `undefined`.
     */
    private resolveBranch(): number | null | undefined {
        const branch = this.currentStep()?.next;
        if (!branch) return undefined;

        const index = this._currentIndex();
        let target: number | null;
        try {
            target = branch(branchContext(index));
        } catch (error) {
            this.reportHookError(index, error);
            return undefined;
        }

        if (target === null) return null;
        if (!Number.isInteger(target) || target < 0 || target >= this.steps().length) {
            this.reportHookError(index, new Error(`tour: step ${index} branched to out-of-range index ${target}`));
            return undefined;
        }
        return target;
    }

    /** Whether {@link storageKey}'s tour has already run to an end. Always `false` without a key. */
    isCompleted(): boolean {
        return readTourCompleted(this.storageKey());
    }

    /** Clears the {@link storageKey} completion flag so the tour may run again. No-op without a key. */
    resetCompletion(): void {
        writeTourCompleted(this.storageKey(), false);
    }

    /** Steps backwards, running the target step's hooks. A no-op on the first step, or while a transition is pending — see {@link canGoBack}. */
    previous(): void {
        if (this._isPending() || !this.canGoBack()) return;
        this.transition(this._currentIndex() - 1, 'backward');
    }

    /** Ends the tour immediately with `done('skipped')`, aborting any in-flight transition. Unlike {@link next} it is not blocked while pending, so the user can always get out. */
    skip(): void {
        this.finish('skipped');
    }

    /** Jump straight to a step, running its hooks. Out-of-range indices are ignored. */
    goTo(index: number): void {
        if (index < 0 || index >= this.steps().length) return;
        const direction: TourDirection = index < this._currentIndex() ? 'backward' : 'forward';
        this.transition(index, direction);
    }

    /** Restart from the first resolvable step without deactivating the tour. */
    restart(): void {
        this.transition(0, 'initial');
    }

    /**
     * Keyboard shortcuts while the tour is active: Enter / ArrowRight advance,
     * ArrowLeft goes back, Escape skips. Each is `preventDefault`ed so the
     * arrows do not also scroll the page behind the highlighted target.
     */
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

    private finish(reason: TourEndReason): void {
        // Invalidate in-flight transitions here rather than leaning on the
        // `active` effect: effects are scheduled, so a hook that resolves in
        // between would otherwise commit a step onto a closed tour.
        this.runToken++;
        this.abortInFlight();
        this._isPending.set(false);
        this.active.set(false);
        if (this.showedAStep) writeTourCompleted(this.storageKey(), true);
        this.done.emit(reason);
    }

    /** Keeps a live tour honest when `steps` shrinks out from under it. */
    private reconcileStepsLength(length: number): void {
        if (length !== this.lastStepsLength) {
            // Indices shifted — what we learned about them no longer applies.
            this.lastStepsLength = length;
            this._unreachable.set(new Set());
        }
        if (!this.wasActive) return;
        if (this._currentIndex() < length) return;
        if (length === 0) {
            this.finish('finished');
            return;
        }
        this.transition(length - 1, 'backward');
    }

    private abortInFlight(): void {
        this.abortController?.abort();
        this.abortController = null;
    }

    private transition(to: number, direction: TourDirection): void {
        if (this.steps().length === 0) return;

        // A fresh run re-tests every step: a list that was empty last time may
        // have rows now.
        if (direction === 'initial') this._unreachable.set(new Set());

        this.abortInFlight();
        const token = ++this.runToken;

        if (!this.hasAsyncSteps()) {
            this.commitOrFinish(this.scanSync(to, direction), this._currentIndex(), direction);
            return;
        }

        const controller = new AbortController();
        this.abortController = controller;
        this._isPending.set(true);
        void this.runAsyncTransition(to, direction, token, controller.signal);
    }

    private commitOrFinish(resolved: ResolvedStep | null, from: number, direction: TourDirection): void {
        if (resolved) {
            this.commitStep(resolved);
            return;
        }
        const fallback = direction === 'backward' ? this.scanSync(from, 'forward') : null;
        if (fallback) {
            this.commitStep(fallback);
            return;
        }
        this.finish('finished');
    }

    /** Walks the steps in the direction of travel looking for a rendered target. */
    private scanSync(start: number, direction: TourDirection): ResolvedStep | null {
        const steps = this.steps();
        const delta = direction === 'backward' ? -1 : 1;
        for (let i = start; i >= 0 && i < steps.length; i += delta) {
            const step = steps[i];
            if (!step) continue;
            const el = this.queryRendered(step.target);
            if (el) return { el, index: i };
            this.reportMissingTarget(i, step.target);
        }
        return null;
    }

    private async runAsyncTransition(
        to: number,
        direction: TourDirection,
        token: number,
        signal: AbortSignal
    ): Promise<void> {
        const from = this._currentIndex();
        if (direction !== 'initial') await this.runExitHook(from, direction, signal);
        if (token !== this.runToken) return;

        let resolved = await this.scanAsync(to, direction, token, signal);
        if (!resolved && direction === 'backward') {
            resolved = await this.scanAsync(from, 'forward', token, signal);
        }
        if (token !== this.runToken) return;

        if (resolved) {
            this.commitStep(resolved);
            return;
        }
        this.finish('finished');
    }

    private async runExitHook(index: number, direction: TourDirection, signal: AbortSignal): Promise<void> {
        const hook = this.steps()[index]?.afterDeactivate;
        if (!hook) return;
        try {
            await hook({ index, direction, signal });
        } catch (error) {
            this.reportHookError(index, error);
        }
    }

    /**
     * Walks the steps in the direction of travel, running each candidate's
     * hooks, until one resolves a rendered target.
     */
    private async scanAsync(
        start: number,
        direction: TourDirection,
        token: number,
        signal: AbortSignal
    ): Promise<ResolvedStep | null> {
        const steps = this.steps();
        const delta = direction === 'backward' ? -1 : 1;
        for (let i = start; i >= 0 && i < steps.length; i += delta) {
            const step = steps[i];
            if (!step) continue;
            if (!(await this.prepareStep(step, { index: i, direction, signal }))) continue;
            const el = await this.awaitTarget(step, signal);
            if (token !== this.runToken) return null;
            if (el) return { el, index: i };
            this.reportMissingTarget(i, step.target);
        }
        return null;
    }

    private async prepareStep(step: TourStep, ctx: TourStepContext): Promise<boolean> {
        try {
            if (step.when && !(await step.when(ctx))) {
                this.markUnreachable(ctx.index);
                this.stepSkipped.emit({ index: ctx.index, reason: 'condition' });
                return false;
            }
            await step.beforeActivate?.(ctx);
            return true;
        } catch (error) {
            this.reportHookError(ctx.index, error);
            this.markUnreachable(ctx.index);
            this.stepSkipped.emit({ index: ctx.index, reason: 'hook-error' });
            return false;
        }
    }

    private reportMissingTarget(index: number, target: string): void {
        globalThis.console?.warn(`[ui-tour] target not found: "${target}" — skipping step.`);
        this.markUnreachable(index);
        this.stepSkipped.emit({ index, reason: 'missing-target' });
    }

    private markUnreachable(index: number): void {
        const next = new Set(this._unreachable());
        next.add(index);
        this._unreachable.set(next);
    }

    private markReachable(index: number): void {
        if (!this._unreachable().has(index)) return;
        const next = new Set(this._unreachable());
        next.delete(index);
        this._unreachable.set(next);
    }

    private reportHookError(index: number, error: unknown): void {
        globalThis.console?.warn(`[ui-tour] step ${index} hook failed — falling back to the default path.`, error);
    }

    /** Resolves a rendered target, optionally waiting for hooks to render it. */
    private async awaitTarget(step: TourStep, signal: AbortSignal): Promise<HTMLElement | null> {
        const immediate = this.queryRendered(step.target);
        if (immediate) return immediate;
        const timeout = step.targetTimeout ?? this.targetTimeout();
        if (timeout <= 0 || signal.aborted) return null;
        return this.pollForTarget(step.target, timeout, signal);
    }

    private pollForTarget(selector: string, timeout: number, signal: AbortSignal): Promise<HTMLElement | null> {
        return new Promise<HTMLElement | null>(resolve => {
            const cleanups: Array<() => void> = [];
            let settled = false;
            const settle = (el: HTMLElement | null): void => {
                if (settled) return;
                settled = true;
                for (const cleanup of cleanups) cleanup();
                resolve(el);
            };
            const check = (): void => {
                const el = this.queryRendered(selector);
                if (el) settle(el);
            };

            const observer = new MutationObserver(check);
            observer.observe(this.document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'hidden'],
            });
            cleanups.push(() => observer.disconnect());

            const timer = globalThis.setTimeout(() => settle(null), timeout);
            cleanups.push(() => globalThis.clearTimeout(timer));

            const onAbort = (): void => settle(null);
            signal.addEventListener('abort', onAbort, { once: true });
            cleanups.push(() => signal.removeEventListener('abort', onAbort));

            check();
        });
    }

    private queryRendered(selector: string): HTMLElement | null {
        let el: HTMLElement | null;
        try {
            el = this.document.querySelector<HTMLElement>(selector);
        } catch {
            globalThis.console?.warn(`[ui-tour] invalid target selector: "${selector}" — skipping step.`);
            return null;
        }
        if (!el?.isConnected) return null;
        return isRendered(el) ? el : null;
    }

    private commitStep({ el: targetEl, index }: ResolvedStep): void {
        this.showedAStep = true;
        this.markReachable(index);
        this.teardownObservers();
        this.clearCurrentHighlight();
        this._isPending.set(false);
        this._isReady.set(false);
        this._currentIndex.set(index);
        this.stepChange.emit(index);

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

    /**
     * A step's target can vanish mid-step — a list reloads, a panel closes.
     * Re-resolve the selector when that happens, and move on if it is truly
     * gone rather than tracking a detached node.
     */
    private reposition(targetEl: HTMLElement): void {
        if (targetEl.isConnected) {
            this.readAndSetRect(targetEl);
            return;
        }
        const step = this.currentStep();
        const replacement = step ? this.queryRendered(step.target) : null;
        if (replacement) {
            this.teardownObservers();
            this.clearCurrentHighlight();
            this.applyHighlight(replacement);
            this.currentTargetEl = replacement;
            this.readAndSetRect(replacement);
            this.setupObservers(replacement);
            return;
        }
        const index = this._currentIndex();
        this.stepSkipped.emit({ index, reason: 'missing-target' });
        this.transition(index + 1, 'forward');
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
            const onReposition = (): void => {
                this.zone.run(() => this.reposition(targetEl));
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
        this.runToken++;
        this.abortInFlight();
        this.teardownObservers();
        this.clearCurrentHighlight();
        this._isPending.set(false);
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
