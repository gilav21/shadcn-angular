import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    viewChild,
    ElementRef,
    HostListener,
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
    },
})
export class ChartBrushComponent {
    readonly width = input(400);
    readonly height = input(40);
    readonly selection = input<BrushSelection | null>(null);
    readonly class = input('');

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

    beginCreate(x: number): void {
        this.mode = 'create';
        this.createAnchor = this.clamp(x);
        this._internal.set({ start: this.createAnchor, end: this.createAnchor });
    }

    beginMove(x: number): void {
        const sel = this.current();
        if (!sel) return;
        this.mode = 'move';
        this.moveAnchor = x;
        this.moveOrigin = { ...sel };
        this._internal.set({ ...sel });
    }

    beginResize(edge: 'start' | 'end', x: number): void {
        const sel = this.current();
        if (!sel) return;
        this.mode = edge === 'start' ? 'resize-start' : 'resize-end';
        this._internal.set({ ...sel });
    }

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

    end(): void {
        if (this.mode === 'idle') return;
        const sel = this._internal();
        if (sel) this._internal.set(this.normalize(sel));
        this.mode = 'idle';
        this.emitNormalized();
    }

    reset(): void {
        this.mode = 'idle';
        this._internal.set(null);
        this.selectionChange.emit(null);
    }

    private localX(evt: MouseEvent | TouchEvent): number {
        const svg = this._svg()?.nativeElement;
        return svg ? pointerToSvg(evt, svg).x : 0;
    }

    onCreateDown(evt: MouseEvent | TouchEvent): void {
        evt.preventDefault();
        this.beginCreate(this.localX(evt));
    }

    onMoveDown(evt: MouseEvent | TouchEvent): void {
        evt.preventDefault();
        evt.stopPropagation();
        this.beginMove(this.localX(evt));
    }

    onResizeDown(evt: MouseEvent | TouchEvent, edge: 'start' | 'end'): void {
        evt.preventDefault();
        evt.stopPropagation();
        this.beginResize(edge, this.localX(evt));
    }

    @HostListener('window:mousemove', ['$event'])
    @HostListener('window:touchmove', ['$event'])
    onWindowMove(evt: MouseEvent | TouchEvent): void {
        if (this.mode === 'idle') return;
        if ('touches' in evt) evt.preventDefault();
        this.pointerMoveTo(this.localX(evt));
    }

    @HostListener('window:mouseup')
    @HostListener('window:touchend')
    onWindowUp(): void {
        this.end();
    }
}
