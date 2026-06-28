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
    readonly series = input.required<ChartSeries[]>();
    readonly size = input(320);
    readonly levels = input(4);
    readonly maxValueInput = input<number | undefined>(undefined);
    readonly fillOpacity = input(0.2);
    readonly showLegend = input(true);
    readonly class = input('');
    readonly title = input<string | undefined>(undefined);
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

    toggleSeries(key: string): void {
        const hidden = this._hidden();
        this._hidden.set(
            hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key],
        );
    }
}
