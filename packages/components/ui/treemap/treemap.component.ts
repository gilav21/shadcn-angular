import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    ElementRef,
    inject,
    AfterViewInit,
    DestroyRef,
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
import { observeChartWidth } from '../../lib/chart-responsive';
import { ChartClickEvent, ChartDirection } from '../../lib/chart.types';
import { formatChartValue, getChartColor, getChartSummary } from '../../lib/chart.utils';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';
import { TreemapLayoutNode, TreemapNode } from './treemap.types';
import { flattenLayout, layoutTreemap, nodeValue } from './treemap.utils';

/** A laid-out node ready for the template: its rectangle, colour and label decision. */
export interface TreemapCell {
    index: number;
    path: string;
    node: TreemapNode;
    value: number;
    depth: number;
    isLeaf: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    fillOpacity: number;
    showLabel: boolean;
    labelX: number;
    labelY: number;
}

const PAD = 4;
const GROUP_INSET = 3;
const MIN_LABEL_WIDTH = 44;
const MIN_LABEL_HEIGHT = 16;
const LABEL_INSET_X = 5;
const LABEL_INSET_Y = 13;
const LEAF_OPACITY = 0.85;
const DEPTH_FADE = 0.12;

@Component({
    selector: 'ui-treemap',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './treemap.component.html',
    imports: [ChartTooltipComponent],
    host: {
        class: 'block',
    },
})
export class TreemapComponent implements AfterViewInit {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

    /**
     * The hierarchy to lay out. A flat `{ label, value }[]` gives proportional
     * rectangles; adding `children` nests them, and a parent's area is then the
     * **sum of its children**, its own `value` ignored. Missing, negative and
     * non-finite values count as 0 — such a node gets a zero-size rectangle
     * rather than distorting its siblings.
     */
    readonly nodes = input.required<TreemapNode[]>();
    /**
     * Fallback width of the SVG user-space coordinate system, in px, used until
     * the host has been measured — from then on the `viewBox` tracks the host's
     * real width. The measurement needs a block-level box, which is why the
     * host is `class: 'block'` and the container `w-full`.
     */
    readonly width = input(500);
    /** Height of the SVG in px, applied literally. Unlike the cartesian charts there is no axis gutter — the plot fills the box. */
    readonly height = input(320);
    /** Inset applied inside every group before laying its children out, in px, so the group border stays visible around them. */
    readonly groupPadding = input(GROUP_INSET);
    /** Draw each node's label when its rectangle is big enough (see {@link minLabelWidth}/{@link minLabelHeight}). Labels never overflow their rectangle. */
    readonly showLabels = input(true);
    /** Narrowest rectangle, in px, that still gets a label. Below this the label is dropped rather than clipped. */
    readonly minLabelWidth = input(MIN_LABEL_WIDTH);
    /** Shortest rectangle, in px, that still gets a label. Below this the label is dropped rather than clipped. */
    readonly minLabelHeight = input(MIN_LABEL_HEIGHT);
    /** Show the shared tooltip for the hovered/focused node. Hover still emits {@link nodeHover} when disabled. */
    readonly showTooltip = input(true);
    /** Corner rounding of each rectangle, in px (SVG `rx`). Use `0` for square corners. */
    readonly cellRadius = input(2);
    /** Suffix appended to every rendered value — tooltip and aria-labels alike (e.g. `' MB'`, `'%'`). Written verbatim with no separating space. */
    readonly unit = input('');
    /** Extra classes merged onto the chart container, which already carries `relative w-full`. */
    readonly class = input('');
    /** Human-readable chart name, used only to prefix the container's accessible summary ("<title>. Treemap with N data points."). */
    readonly title = input<string | undefined>(undefined);
    /**
     * Layout direction. `'auto'` (default) resolves from the host element's
     * inherited DOM direction after view init; `'ltr'`/`'rtl'` force it. RTL
     * mirrors the layout horizontally, so the largest node sits top-right, and
     * anchors the labels to the right edge of their rectangle. See {@link isRtl}.
     */
    readonly dir = input<ChartDirection>('auto');

    /** Emitted when a node is clicked, or activated with Enter/Space while focused. `point` is the original {@link TreemapNode} — groups included. */
    readonly nodeClick = output<ChartClickEvent<TreemapNode>>();
    /** Emitted with the node on hover/focus and with `null` on mouse-leave/blur, so consumers can mirror the highlight. */
    readonly nodeHover = output<ChartClickEvent<TreemapNode> | null>();

    private readonly _hover = signal<number | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });
    private readonly _domRtl = signal(false);

    readonly hoveredIndex = this._hover.asReadonly();
    readonly tooltipPos = this._tooltipPos.asReadonly();

    readonly classes = computed(() => cn('relative w-full', this.class()));
    readonly svgWidth = computed(() => this._measuredWidth() ?? this.width());
    readonly viewBox = computed(() => `0 0 ${this.svgWidth()} ${this.height()}`);

    readonly isRtl = computed(() => {
        const d = this.dir();
        if (d === 'rtl') return true;
        if (d === 'ltr') return false;
        return this._domRtl();
    });

    /** Total magnitude of the hierarchy — the denominator behind every percentage. */
    readonly total = computed(() => this.nodes().reduce((sum, n) => sum + nodeValue(n), 0));

    /** True when nothing has a positive value, which is what the empty state renders on. */
    readonly isEmpty = computed(() => this.total() <= 0);

    readonly ariaLabel = computed(() =>
        getChartSummary('Treemap', this.nodes().length, this.title()),
    );

    protected readonly plot = computed(() => ({
        x: PAD,
        y: PAD,
        width: Math.max(0, this.svgWidth() - PAD * 2),
        height: Math.max(0, this.height() - PAD * 2),
    }));

    /**
     * The squarified hierarchy. Depends only on {@link nodes},
     * {@link groupPadding} and the plot box, so hovering never re-runs the
     * layout.
     */
    private readonly layout = computed((): TreemapLayoutNode[] =>
        layoutTreemap(this.nodes(), this.plot(), this.groupPadding()),
    );

    readonly cells = computed((): TreemapCell[] => {
        const plot = this.plot();
        const rtl = this.isRtl();
        const roots = this.layout();
        const rootColor = new Map<string, string>(
            roots.map((r, i) => [r.path, getChartColor(i, r.node.color)]),
        );

        return flattenLayout(roots).map((n, index) => {
            const rootPath = n.path.split('/')[0];
            const color = n.node.color ?? rootColor.get(rootPath) ?? getChartColor(0);
            const x = rtl ? plot.x + plot.width - (n.rect.x - plot.x) - n.rect.width : n.rect.x;
            const isLeaf = n.children.length === 0;
            const showLabel =
                this.showLabels() &&
                n.rect.width >= this.minLabelWidth() &&
                n.rect.height >= this.minLabelHeight();

            return {
                index,
                path: n.path,
                node: n.node,
                value: n.value,
                depth: n.depth,
                isLeaf,
                x,
                y: n.rect.y,
                width: n.rect.width,
                height: n.rect.height,
                color,
                fillOpacity: isLeaf ? Math.max(0.2, LEAF_OPACITY - n.depth * DEPTH_FADE) : 0,
                showLabel,
                labelX: rtl ? x + n.rect.width - LABEL_INSET_X : x + LABEL_INSET_X,
                labelY: n.rect.y + LABEL_INSET_Y,
            };
        });
    });

    /** Text anchor for the labels, flipped in RTL so they hug the reading edge of their rectangle. */
    readonly labelAnchor = computed<'start' | 'end'>(() => (this.isRtl() ? 'end' : 'start'));

    private readonly hoveredCell = computed(() => {
        const i = this._hover();
        return i === null ? null : this.cells()[i] ?? null;
    });

    readonly tooltipTitle = computed(() => this.hoveredCell()?.node.label);

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const cell = this.hoveredCell();
        if (!cell) return [];
        const total = this.total();
        const rows: ChartTooltipRow[] = [
            { label: 'Value', value: this.formatValue(cell.value), color: cell.color },
        ];
        if (total > 0) {
            rows.push({
                label: 'Share',
                value: `${formatChartValue((cell.value / total) * 100, { decimals: 1 })}%`,
            });
        }
        return rows;
    });

    ngAfterViewInit(): void {
        this._domRtl.set(isRtl(this.el.nativeElement));
    }

    /**
     * Marks the node as active — brightening it, parking the tooltip at its
     * top-left corner and emitting {@link nodeHover}. Bound to both `mouseenter`
     * and `focus` so keyboard users get the same highlight.
     */
    onCellHover(cell: TreemapCell): void {
        this._hover.set(cell.index);
        this._tooltipPos.set({ x: cell.x + 8, y: Math.max(8, cell.y + 8) });
        this.nodeHover.emit({ point: cell.node, index: cell.index });
    }

    /** Clears the active node (hiding the tooltip) and emits `null` on {@link nodeHover}. Bound to `mouseleave` and `blur`. */
    onCellLeave(): void {
        this._hover.set(null);
        this.nodeHover.emit(null);
    }

    /**
     * Emits {@link nodeClick} for the activated node — groups included, so a
     * consumer can implement drill-down. `event` is forwarded only when it is a
     * real `MouseEvent`; keyboard activation (Enter/Space) leaves `event`
     * undefined on the payload.
     */
    onCellClick(event: Event, cell: TreemapCell): void {
        this.nodeClick.emit({
            point: cell.node,
            index: cell.index,
            event: event instanceof MouseEvent ? event : undefined,
        });
    }

    /** Accessible name for a node, pairing its label with its value so the area's meaning survives without sight. */
    getCellAriaLabel(cell: TreemapCell): string {
        return `${cell.node.label}: ${this.formatValue(cell.value)}`;
    }

    /** Formats a node value for the tooltip and aria-labels, compacted (`1.2K`, `3.4M`) and suffixed with {@link unit}. */
    formatValue(value: number): string {
        return formatChartValue(value, { compact: true }) + this.unit();
    }
}
