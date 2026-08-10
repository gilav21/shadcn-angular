import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    viewChild,
    ElementRef,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { pointerToSvg } from '../../lib/chart-interaction';

export interface BrushSelection {
    start: number;
    end: number;
}

type BrushMode = 'idle' | 'create' | 'move' | 'resize-start' | 'resize-end';

/**
 * Controlled zoom/pan/brush overlay for dense cartesian charts. Works in
 * pixel space along the x-axis; the host chart maps pixels↔domain via a scale.
 * Selection logic is unit-tested directly; DOM handlers (mouse + touch) just
 * translate events to a local x and delegate to those methods.
 */
@Component({
    selector: 'ui-chart-brush',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './chart-brush.component.html',
    host: {
        class: 'block',
        '(window:mousemove)': 'onWindowMove($event)',
        '(window:touchmove)': 'onWindowMove($event)',
        '(window:mouseup)': 'onWindowUp()',
        '(window:touchend)': 'onWindowUp()',
    },
})
export class ChartBrushComponent {
    /**
     * Width of the SVG user-space coordinate system, in px, and simultaneously
     * the clamp ceiling for every selection coordinate (`0…width`). Set it to
     * the *plot* width of the chart being brushed so a `start`/`end` can be fed
     * straight into that chart's x-scale `invert()` with no rescaling. The SVG
     * itself is `w-full` with `preserveAspectRatio="none"`, so it stretches to
     * the container regardless — this value is the domain, not the render size.
     */
    readonly width = input(400);
    /**
     * Rendered height of the brush strip, in px, used for both the `height`
     * attribute and the viewBox, so it is a literal size and does not scale
     * with the container. It also fixes the hit height of the track and of the
     * two drag handles.
     */
    readonly height = input(40);
    /**
     * Initial/controlled selection in the same pixel space as {@link width};
     * `null` means nothing brushed. It seeds {@link current} only until the
     * first interaction — once the user drags, the component's internal state
     * takes over and later changes to this input no longer move the brush.
     * Call {@link reset} to hand control back.
     */
    readonly selection = input<BrushSelection | null>(null);
    /** Extra classes merged onto the SVG, which already carries `block w-full select-none`. */
    readonly class = input('');

    /**
     * Fires on every pointer move during a drag (live filtering of the host
     * chart), again on release, and with `null` when the Reset button calls
     * {@link reset}. The payload is always normalized so `start <= end`, even
     * while dragging leftwards.
     */
    readonly selectionChange = output<BrushSelection | null>();

    private readonly _svg = viewChild<ElementRef<SVGSVGElement>>('brushSvg');
    private readonly _internal = signal<BrushSelection | null | undefined>(undefined);
    private mode: BrushMode = 'idle';
    private moveAnchor = 0;
    private moveOrigin: BrushSelection = { start: 0, end: 0 };
    private createAnchor = 0;

    readonly classes = computed(() => cn('block w-full select-none', this.class()));
    readonly viewBox = computed(() => `0 0 ${this.width()} ${this.height()}`);

    readonly current = computed<BrushSelection | null>(() => {
        const internal = this._internal();
        return internal === undefined ? this.selection() ?? null : internal;
    });

    readonly rect = computed(() => {
        const sel = this.current();
        if (!sel) return null;
        const x = Math.min(sel.start, sel.end);
        return { x, width: Math.abs(sel.end - sel.start) };
    });

    private clamp(x: number): number {
        return Math.max(0, Math.min(this.width(), x));
    }

    private normalize(sel: BrushSelection): BrushSelection {
        return { start: Math.min(sel.start, sel.end), end: Math.max(sel.start, sel.end) };
    }

    private emitNormalized(): void {
        const sel = this._internal();
        this.selectionChange.emit(sel ? this.normalize(sel) : null);
    }

    /**
     * Starts a fresh selection, discarding any existing one: it collapses the
     * brush to a zero-width range anchored at `x` (clamped to `0…`
     * {@link width}) and enters create mode, so the following
     * {@link pointerMoveTo} calls sweep the other edge out from that anchor.
     * `x` is in SVG user space — {@link onCreateDown} is the DOM adapter that
     * converts a mouse/touch event for you.
     */
    beginCreate(x: number): void {
        this.mode = 'create';
        this.createAnchor = this.clamp(x);
        this._internal.set({ start: this.createAnchor, end: this.createAnchor });
    }

    /**
     * Begins panning the whole selection, remembering `x` as the grab anchor so
     * the range slides by the pointer delta and keeps its width. No-op when
     * nothing is selected. Both edges are clamped to `0…`{@link width}, so
     * dragging into a wall squashes the range rather than pushing it off.
     */
    beginMove(x: number): void {
        const sel = this.current();
        if (!sel) return;
        this.mode = 'move';
        this.moveAnchor = x;
        this.moveOrigin = { ...sel };
        this._internal.set({ ...sel });
    }

    /**
     * Begins dragging one edge of the selection, pinning the other. The named
     * edge jumps to `x` immediately (clamped to `0…`{@link width}) rather than
     * waiting for the first move. Dragging an edge past its partner is allowed
     * — the range is only re-sorted on emit, see {@link selectionChange}.
     * No-op when nothing is selected.
     */
    beginResize(edge: 'start' | 'end', x: number): void {
        const sel = this.current();
        if (!sel) return;
        this.mode = edge === 'start' ? 'resize-start' : 'resize-end';
        const seeded = edge === 'start'
            ? { start: this.clamp(x), end: sel.end }
            : { start: sel.start, end: this.clamp(x) };
        this._internal.set(seeded);
    }

    /**
     * Advances the in-progress gesture to `x` (SVG user space), applying
     * whichever of create/move/resize was started, and emits the updated range
     * on {@link selectionChange}. Silently ignored when no gesture is active,
     * which is what makes it safe to wire to a window-level move listener.
     */
    pointerMoveTo(x: number): void {
        if (this.mode === 'idle') return;
        const sel = this._internal() ?? { start: 0, end: 0 };
        this._internal.set(this.applyMode(sel, x));
        this.emitNormalized();
    }

    private applyMode(sel: BrushSelection, x: number): BrushSelection {
        if (this.mode === 'create') {
            return { start: this.createAnchor, end: this.clamp(x) };
        }
        if (this.mode === 'move') {
            const delta = x - this.moveAnchor;
            return {
                start: this.clamp(this.moveOrigin.start + delta),
                end: this.clamp(this.moveOrigin.end + delta),
            };
        }
        if (this.mode === 'resize-start') {
            return { start: this.clamp(x), end: sel.end };
        }
        return { start: sel.start, end: this.clamp(x) };
    }

    /**
     * Ends the gesture: sorts the stored range so `start <= end` (undoing an
     * edge that was dragged past its partner) and emits a final
     * {@link selectionChange}. Idempotent — a no-op when no gesture is active,
     * so the window `mouseup`/`touchend` listener can fire freely.
     */
    end(): void {
        if (this.mode === 'idle') return;
        const sel = this._internal();
        if (sel) this._internal.set(this.normalize(sel));
        this.mode = 'idle';
        this.emitNormalized();
    }

    /**
     * Clears the brush and emits `null` on {@link selectionChange} so the host
     * chart can drop back to its full range. Bound to the "Reset zoom" button
     * that appears while a selection exists. This clears the *internal* state
     * to an explicit empty value, so the {@link selection} input still does not
     * regain control.
     */
    reset(): void {
        this.mode = 'idle';
        this._internal.set(null);
        this.selectionChange.emit(null);
    }

    private localX(evt: MouseEvent | TouchEvent): number {
        const svg = this._svg()?.nativeElement;
        return svg ? pointerToSvg(evt, svg).x : 0;
    }

    /**
     * `mousedown`/`touchstart` handler on the background track: converts the
     * event to SVG user space and calls {@link beginCreate}. Prevents the
     * default so a touch-drag scrolls the brush, not the page (the track also
     * sets `touch-action: none`).
     */
    onCreateDown(evt: MouseEvent | TouchEvent): void {
        evt.preventDefault();
        this.beginCreate(this.localX(evt));
    }

    /**
     * `mousedown`/`touchstart` handler on the selected band, delegating to
     * {@link beginMove}. Stops propagation so the press does not also reach the
     * track underneath and start a new selection via {@link onCreateDown}.
     */
    onMoveDown(evt: MouseEvent | TouchEvent): void {
        evt.preventDefault();
        evt.stopPropagation();
        this.beginMove(this.localX(evt));
    }

    /**
     * `mousedown`/`touchstart` handler on one of the 6px edge handles,
     * delegating to {@link beginResize}. Stops propagation so the press is not
     * also read as a band move or a new selection.
     */
    onResizeDown(evt: MouseEvent | TouchEvent, edge: 'start' | 'end'): void {
        evt.preventDefault();
        evt.stopPropagation();
        this.beginResize(edge, this.localX(evt));
    }

    /**
     * Window-level `mousemove`/`touchmove` handler — listening on the window
     * rather than the SVG keeps a drag alive when the pointer leaves the strip.
     * Returns immediately unless a gesture is active; for touch it also
     * suppresses the default so the drag does not scroll the page.
     */
    onWindowMove(evt: MouseEvent | TouchEvent): void {
        if (this.mode === 'idle') return;
        if ('touches' in evt) evt.preventDefault();
        this.pointerMoveTo(this.localX(evt));
    }

    /** Window-level `mouseup`/`touchend` handler; finishes any active drag via {@link end}, wherever the pointer was released. */
    onWindowUp(): void {
        this.end();
    }
}
