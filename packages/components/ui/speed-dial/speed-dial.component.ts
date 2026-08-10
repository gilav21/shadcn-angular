import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    ElementRef,
    OnDestroy,
    booleanAttribute,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../../lib/utils';

export type SpeedDialType = 'linear' | 'circle' | 'semi-circle' | 'quarter-circle';
export type SpeedDialDirection =
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'up-left'
    | 'up-right'
    | 'down-left'
    | 'down-right';

export const SPEED_DIAL = new InjectionToken<SpeedDialComponent>('SPEED_DIAL');

/**
 * SpeedDial - A floating action button with a popup menu of action items
 *
 * Usage:
 * <ui-speed-dial type="linear" direction="up">
 *   <ui-speed-dial-trigger>
 *     <ui-button size="icon" class="rounded-full">+</ui-button>
 *   </ui-speed-dial-trigger>
 *   <ui-speed-dial-menu>
 *     <ui-speed-dial-item>
 *       <ui-button size="icon" uiTooltip="Edit">✏️</ui-button>
 *     </ui-speed-dial-item>
 *     <ui-speed-dial-item>
 *       <ui-button size="icon" uiTooltip="Delete">🗑️</ui-button>
 *     </ui-speed-dial-item>
 *   </ui-speed-dial-menu>
 * </ui-speed-dial>
 */
@Component({
    selector: 'ui-speed-dial',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: SPEED_DIAL, useExisting: forwardRef(() => SpeedDialComponent) }],
    template: `<ng-content />`,
    host: {
        '[class]': 'hostClasses()',
        '[attr.data-slot]': '"speed-dial"',
        '[attr.data-state]': 'open() ? "open" : "closed"',
    },
})
export class SpeedDialComponent implements OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly document = inject(DOCUMENT);

    /**
     * Layout of the open menu (default `'linear'`).
     *
     * - `'linear'` — items stack in a flex row/column next to the trigger, in
     *   the {@link direction} given; {@link radius} is not used for layout.
     * - `'circle'` — items are spread over a full 360°, `360 / itemCount` apart,
     *   at {@link radius} px from the trigger centre; {@link direction} is ignored.
     * - `'semi-circle'` — 180° arc whose orientation comes from the four
     *   straight {@link direction} values (`up`/`down`/`left`/`right`); diagonal
     *   directions fall back to the `up`-side arc.
     * - `'quarter-circle'` — 90° arc placed by the four diagonal
     *   {@link direction} values (`up-right`/`up-left`/`down-right`/`down-left`);
     *   straight directions fall back to `up-right`.
     *
     * For the arc types the items are spaced over `itemCount - 1` steps, so the
     * first and last item sit exactly on the arc's end angles.
     */
    type = input<SpeedDialType>('linear');
    /**
     * Where the menu opens relative to the trigger (default `'up'`). Only the
     * four straight values apply to `'linear'` and `'semi-circle'`, only the four
     * diagonals apply to `'quarter-circle'`, and `'circle'` ignores it entirely —
     * see {@link type} for the per-type fallbacks. Also decides which viewport
     * edges {@link showAt} clamps a linear menu against.
     */
    direction = input<SpeedDialDirection>('up');
    /**
     * Distance in px from the trigger centre to each item, for the `'circle'`,
     * `'semi-circle'` and `'quarter-circle'` {@link type}s (default `80`). It has
     * no effect on `'linear'` layout, but it is still used by {@link showAt},
     * which reserves `radius + 24` px plus an 8px gutter when clamping the menu
     * inside the viewport — so raising it also pushes context menus further from
     * the edges.
     */
    radius = input(80);
    /**
     * Per-item stagger in ms (default `80`): item *i* starts its open transition
     * after `i * transitionDelay`, and on close the order reverses so the last
     * item leaves first. Ignored while the menu is positioned by
     * {@link showAt} — context menus always use a fixed 30ms stagger.
     */
    transitionDelay = input(80);
    /**
     * When true, {@link toggle}, {@link show} and {@link showAt} become no-ops so
     * the menu can never be opened (default `false`). Accepts bare attribute
     * presence via `booleanAttribute`. It does not block {@link hide}, and it does
     * not disable or dim the projected trigger content — disable that separately.
     */
    disabled = input(false, { transform: booleanAttribute });

    open = signal(false);
    contextPosition = signal<{ x: number; y: number } | null>(null);
    isRepositioning = signal(false);

    /**
     * Emits the new open state on every {@link show}, {@link showAt} and
     * {@link hide}. Note {@link hide} runs on every document click outside the
     * host, so `false` can be emitted repeatedly while the menu is already
     * closed — de-duplicate if the handler is not idempotent.
     */
    visibleChange = output<boolean>();
    /**
     * Emits after the menu opens, alongside `visibleChange(true)`. For
     * {@link showAt} it fires on the next task, once the reposition has settled.
     */
    shown = output<void>();
    /**
     * Emits on every {@link hide} call — including outside-click dismissals when
     * the menu was already closed. Pairs with {@link visibleChange}.
     */
    hidden = output<void>();

    hostClasses = computed(() =>
        cn(
            'inline-flex',
            this.contextPosition() && 'relative'
        )
    );

    private readonly clickListener = (event: MouseEvent): void => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.hide();
        }
    };

    constructor() {
        this.document.addEventListener('click', this.clickListener);
    }

    ngOnDestroy(): void {
        this.document.removeEventListener('click', this.clickListener);
    }

    /**
     * Opens via {@link show} or closes via {@link hide} depending on the current
     * state. No-op while {@link disabled}. This is what the trigger's click and
     * Enter/Space handlers call.
     */
    toggle(): void {
        if (this.disabled()) return;
        if (this.open()) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Opens the menu anchored to the trigger: it clears any coordinates left by
     * {@link showAt}, so the menu returns to its normal absolutely-positioned
     * placement driven by {@link type} and {@link direction}. No-op while
     * {@link disabled}. Emits {@link visibleChange} and {@link shown}
     * synchronously.
     */
    show(): void {
        if (this.disabled()) return;
        this.contextPosition.set(null);
        this.open.set(true);
        this.visibleChange.emit(true);
        this.shown.emit();
    }

    /**
     * Opens the menu at an explicit point instead of at the trigger — the
     * context-menu form of {@link show}. The menu switches to `position: fixed`
     * with `left`/`top` set from the clamped coordinates, and items use a fixed
     * 30ms stagger rather than {@link transitionDelay}.
     *
     * The point is clamped so the whole menu stays on screen: circular types are
     * kept `radius + 32`px inside every viewport edge, linear types only against
     * the edges their {@link direction} grows towards. Clamping is measured
     * against the nearest `[uiSpeedDialContextTrigger]` ancestor, falling back to
     * the host's parent element.
     *
     * Opening is deferred by one task (the menu is closed and re-opened) so the
     * items jump to the new origin without animating across the screen.
     * No-op while {@link disabled}.
     *
     * @param x Horizontal coordinate; the directive passes `event.clientX`.
     * @param y Vertical coordinate; the directive passes `event.clientY`.
     */
    showAt(x: number, y: number): void {
        if (this.disabled()) return;

        const container = this.el.nativeElement.closest('[uiSpeedDialContextTrigger]') as HTMLElement | null
            ?? this.el.nativeElement.parentElement;

        if (container) {
            const clamped = this.clampToContainer(x, y, container);
            x = clamped.x;
            y = clamped.y;
        }

        this.open.set(false);
        this.isRepositioning.set(true);
        this.contextPosition.set({ x, y });
        setTimeout(() => {
            this.isRepositioning.set(false);
            this.open.set(true);
            this.visibleChange.emit(true);
            this.shown.emit();
        }, 0);
    }

    private clampToContainer(x: number, y: number, container: HTMLElement): { x: number; y: number } {
        const r = this.radius() + 24;
        const type = this.type();
        const containerRect = container.getBoundingClientRect();
        const vw = globalThis.innerWidth;
        const vh = globalThis.innerHeight;

        const absX = containerRect.left + x;
        const absY = containerRect.top + y;

        let clampedAbsX = absX;
        let clampedAbsY = absY;

        if (type === 'circle' || type === 'semi-circle' || type === 'quarter-circle') {
            clampedAbsX = Math.max(r + 8, Math.min(clampedAbsX, vw - r - 8));
            clampedAbsY = Math.max(r + 8, Math.min(clampedAbsY, vh - r - 8));
        } else {
            const dir = this.direction();
            if (dir.includes('right')) clampedAbsX = Math.min(clampedAbsX, vw - r - 8);
            if (dir.includes('left')) clampedAbsX = Math.max(clampedAbsX, r + 8);
            if (dir.includes('down')) clampedAbsY = Math.min(clampedAbsY, vh - r - 8);
            if (dir.includes('up')) clampedAbsY = Math.max(clampedAbsY, r + 8);
        }

        return {
            x: x + (clampedAbsX - absX),
            y: y + (clampedAbsY - absY),
        };
    }

    /**
     * Closes the menu and emits {@link visibleChange} and {@link hidden}. Unlike
     * {@link show} it is not gated by {@link disabled}, and it runs
     * unconditionally — a document-level click listener calls it for every click
     * outside the host, and the mask and context trigger call it too. Any
     * coordinates from {@link showAt} are kept, so the next {@link showAt}
     * re-positions while {@link show} resets to the trigger anchor.
     */
    hide(): void {
        this.open.set(false);
        this.visibleChange.emit(false);
        this.hidden.emit();
    }
}
