import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { ChartSeries, ChartDirection } from '../../lib/chart.types';
import { getChartColor, getChartSummary } from '../../lib/chart.utils';
import { radarPoint, polygonPath } from '../../lib/chart-polar';
import { ChartLegendComponent, ChartLegendItem } from '../chart-legend';

interface RadarPolygon {
    key: string;
    name: string;
    color: string;
    path: string;
    vertices: { x: number; y: number; axis: string; value: number }[];
}

interface AxisSpoke {
    axis: string;
    x: number;
    y: number;
    labelX: number;
    labelY: number;
}

@Component({
    selector: 'ui-radar-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './radar-chart.component.html',
    imports: [ChartLegendComponent],
    host: {
        class: 'block',
    },
})
export class RadarChartComponent {
    /**
     * One filled polygon per series, coloured by its index in this array unless
     * the series carries its own `color`. Every series must repeat the same
     * `data[].name` values in the same order: the axis ring comes from the
     * **first** series alone (see {@link axes}) and each later series' points
     * are matched to axes positionally, so a shorter or re-ordered series is
     * plotted against the wrong spokes. Series with an `id` use it as their
     * legend/visibility key, otherwise `name` is the key — give duplicate names
     * distinct `id`s or toggling one hides both. All series share one radial
     * scale (see {@link maxValue}).
     */
    readonly series = input.required<ChartSeries[]>();
    /**
     * Edge length of the square SVG, in px, written to both `width` and
     * `height` — the radar is drawn at a fixed pixel size and does **not**
     * scale with its container (unlike the cartesian charts here, it uses no
     * `ResizeObserver`). The plot radius is `size / 2 - 36`, the 36px reserving
     * room for the axis labels, so very small sizes squeeze the polygon before
     * they squeeze the text. For a responsive layout, drive this input from
     * your own breakpoint logic.
     */
    readonly size = input(320);
    /**
     * Number of concentric background rings, evenly spaced from the centre out
     * to the full radius. The outermost ring sits at {@link maxValue}; the rings
     * are decoration only and carry no printed tick values.
     */
    readonly levels = input(4);
    /**
     * Radial upper bound — the value that reaches the outer ring. Omit to
     * auto-scale from the largest value across *all* series (see
     * {@link maxValue}); set it to keep several radars on a shared scale, or to
     * pin a natural ceiling such as 100 for percentage data. Note the auto scale
     * adds no headroom, so the peak point lands exactly on the outer ring.
     */
    readonly maxValueInput = input<number | undefined>(undefined);
    /**
     * `fill-opacity` of each series polygon, `0`–`1`. The stroke stays fully
     * opaque, so `0` yields outline-only radars — useful once several
     * overlapping series make the stacked fills muddy.
     */
    readonly fillOpacity = input(0.2);
    /**
     * Render the {@link ChartLegendComponent} strip under the chart. The legend
     * is the only built-in way to toggle series visibility, so hiding it also
     * removes that affordance — drive {@link toggleSeries} yourself if you still
     * need it.
     */
    readonly showLegend = input(true);
    /** Extra classes merged onto the chart container, which already carries `inline-flex flex-col items-center`. */
    readonly class = input('');
    /** Human-readable chart name, used only to prefix the SVG group's accessible summary (see {@link ariaLabel}). */
    readonly title = input<string | undefined>(undefined);
    /**
     * Layout direction, accepted for parity with the cartesian charts in this
     * family. The radar is radially symmetric and its labels are placed from
     * the polar geometry, so no part of the current rendering reads this value;
     * inherited DOM direction still governs the axis label text itself.
     */
    readonly dir = input<ChartDirection>('auto');

    private readonly _hidden = signal<string[]>([]);
    readonly hiddenSeries = this._hidden.asReadonly();

    readonly classes = computed(() => cn('inline-flex flex-col items-center', this.class()));
    readonly viewBox = computed(() => `0 0 ${this.size()} ${this.size()}`);
    readonly center = computed(() => this.size() / 2);
    readonly radius = computed(() => this.size() / 2 - 36);

    readonly ariaLabel = computed(() =>
        getChartSummary('Radar chart', this.axes().length, this.title()),
    );

    readonly axes = computed(() => this.series()[0]?.data.map(d => d.name) ?? []);

    private seriesKey(s: ChartSeries): string {
        return s.id ?? s.name;
    }

    readonly legendItems = computed((): ChartLegendItem[] =>
        this.series().map((s, i) => ({
            key: this.seriesKey(s),
            label: s.name,
            color: getChartColor(i, s.color),
        })),
    );

    private readonly visibleSeries = computed(() =>
        this.series()
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => !this._hidden().includes(this.seriesKey(s))),
    );

    readonly maxValue = computed(() => {
        const explicit = this.maxValueInput();
        if (explicit !== undefined) return explicit;
        const values = this.series().flatMap(s => s.data.map(d => d.value));
        return values.length ? Math.max(...values) : 1;
    });

    readonly rings = computed(() => {
        const axisCount = this.axes().length;
        const levels = this.levels();
        const result: string[] = [];
        for (let level = 1; level <= levels; level++) {
            const r = (this.radius() * level) / levels;
            const points = this.axes()
                .map((_, i) => radarPoint(this.center(), this.center(), r, i, axisCount, 1, 1))
                .map(p => `${p.x},${p.y}`)
                .join(' ');
            result.push(points);
        }
        return result;
    });

    readonly spokes = computed((): AxisSpoke[] => {
        const axisCount = this.axes().length;
        return this.axes().map((axis, i) => {
            const outer = radarPoint(this.center(), this.center(), this.radius(), i, axisCount, 1, 1);
            const label = radarPoint(this.center(), this.center(), this.radius() + 18, i, axisCount, 1, 1);
            return { axis, x: outer.x, y: outer.y, labelX: label.x, labelY: label.y };
        });
    });

    readonly seriesPolygons = computed((): RadarPolygon[] => {
        const axisCount = this.axes().length;
        const max = this.maxValue();
        return this.visibleSeries().map(({ s, i }) => {
            const vertices = s.data.map((d, ai) => {
                const p = radarPoint(this.center(), this.center(), this.radius(), ai, axisCount, d.value, max);
                return { x: p.x, y: p.y, axis: d.name, value: d.value };
            });
            return {
                key: this.seriesKey(s),
                name: s.name,
                color: getChartColor(i, s.color),
                path: polygonPath(vertices),
                vertices,
            };
        });
    });

    /**
     * Flips one series between shown and hidden, keyed by its `id` (or `name`
     * when no `id` is given) — the same key the legend emits. Hidden series drop
     * out of {@link seriesPolygons} but still count towards {@link maxValue}, so
     * the rings keep their scale while series are toggled. Toggling is
     * cumulative: call it again with the same key to restore the series.
     */
    toggleSeries(key: string): void {
        const hidden = this._hidden();
        this._hidden.set(
            hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key],
        );
    }
}
