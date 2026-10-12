import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AreaChartComponent } from '../ui/area-chart';
import { BarChartComponent } from '../ui/bar-chart';
import { BarChartDrilldownComponent } from '../ui/bar-chart-drilldown';
import { BarRaceChartComponent } from '../ui/bar-race-chart';
import { BoxplotComponent } from '../ui/boxplot';
import { BubbleChartComponent } from '../ui/bubble-chart';
import { BulletChartComponent } from '../ui/bullet-chart';
import { CalendarHeatmapComponent } from '../ui/calendar-heatmap';
import { CandlestickComponent } from '../ui/candlestick';
import { ColumnRangeChartComponent } from '../ui/column-range-chart';
import { ComboChartComponent } from '../ui/combo-chart';
import { FunnelChartComponent } from '../ui/funnel-chart';
import { GaugeChartComponent } from '../ui/gauge-chart';
import { HeatmapComponent } from '../ui/heatmap';
import { HistogramComponent } from '../ui/histogram';
import { LineChartComponent } from '../ui/line-chart';
import { OrgChartComponent } from '../ui/org-chart';
import { PieChartComponent } from '../ui/pie-chart';
import { PieChartDrilldownComponent } from '../ui/pie-chart-drilldown';
import { RadarChartComponent } from '../ui/radar-chart';
import { ScatterChartComponent } from '../ui/scatter-chart';
import { StackedBarChartComponent } from '../ui/stacked-bar-chart';
import { TreemapComponent } from '../ui/treemap';
import { WaterfallChartComponent } from '../ui/waterfall-chart';

/**
 * The cross-chart invariant (specs/chart-degenerate-data-spec.md): every chart
 * renders any finite dataset with every mark inside the plot area and no
 * NaN/Infinity in any SVG attribute. One table, every chart, every data class.
 *
 * Real browser only: it reads `getBBox()` / `getScreenCTM()` and the rendered
 * width of tooltips, which need a layout engine.
 */

// ---------------------------------------------------------------------------
// Data classes (§2.0). A seeded PRNG varies the values inside each class.
// ---------------------------------------------------------------------------

type DataClassId =
    | 'positive-fractional'
    | 'all-negative'
    | 'mixed-sign'
    | 'all-zero'
    | 'single-positive'
    | 'single-negative'
    | 'all-equal'
    | 'duplicate-labels'
    | 'duplicate-values'
    | 'huge'
    | 'tiny';

interface DataClass {
    id: DataClassId;
    names: string[];
    values: number[];
}

function mulberry32(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function dataClasses(seed: number): DataClass[] {
    const rand = mulberry32(seed);
    const count = 3 + Math.floor(rand() * 4);
    const range = (make: (i: number) => number): number[] => Array.from({ length: count }, (_, i) => make(i));
    const labels = (n: number): string[] => Array.from({ length: n }, (_, i) => `C${i + 1}`);
    return [
        { id: 'positive-fractional', names: labels(count), values: range(() => round2(1 + rand() * 9)) },
        { id: 'all-negative', names: labels(count), values: range(() => -round2(0.5 + rand() * 60)) },
        {
            id: 'mixed-sign',
            names: labels(count),
            values: range(i => (i % 2 === 0 ? -1 : 1) * round2(0.01 + rand() * 50)),
        },
        { id: 'all-zero', names: labels(3), values: [0, 0, 0] },
        { id: 'single-positive', names: ['Only'], values: [round2(1 + rand() * 90)] },
        { id: 'single-negative', names: ['Only'], values: [-round2(1 + rand() * 90)] },
        { id: 'all-equal', names: labels(3), values: [7, 7, 7] },
        { id: 'duplicate-labels', names: ['Q1', 'Q1', 'Other', 'Other'], values: [round2(1 + rand() * 9), 8, 2.25, 6] },
        { id: 'duplicate-values', names: labels(4), values: [5, 5, 9, 5] },
        { id: 'huge', names: labels(3), values: [1.2e12, 3.4e12, -5e11] },
        { id: 'tiny', names: labels(3), values: [1e-6, 3e-6, -2e-6] },
    ];
}

const SEEDS = [11, 202];

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

interface Box {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

type Plot = { kind: 'rect'; box: Box } | { kind: 'circle'; cx: number; cy: number; r: number };

const TOLERANCE = 0.5;

function rootBox(el: SVGGraphicsElement, svg: SVGSVGElement): Box {
    const bbox = el.getBBox();
    const elCtm = el.getScreenCTM();
    const rootCtm = svg.getScreenCTM();
    if (!elCtm || !rootCtm) throw new Error('element is not rendered');
    const matrix = rootCtm.inverse().multiply(elCtm);
    const corners = [
        new DOMPoint(bbox.x, bbox.y),
        new DOMPoint(bbox.x + bbox.width, bbox.y),
        new DOMPoint(bbox.x, bbox.y + bbox.height),
        new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
    ].map(p => p.matrixTransform(matrix));
    const xs = corners.map(p => p.x);
    const ys = corners.map(p => p.y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function centerOf(box: Box): { x: number; y: number } {
    return { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
}

function insideBox(box: Box, plot: Box): boolean {
    return (
        box.x0 >= plot.x0 - TOLERANCE &&
        box.y0 >= plot.y0 - TOLERANCE &&
        box.x1 <= plot.x1 + TOLERANCE &&
        box.y1 <= plot.y1 + TOLERANCE
    );
}

function inside(box: Box, plot: Plot, mode: 'bbox' | 'center'): boolean {
    if (plot.kind === 'rect') {
        if (mode === 'center') {
            const c = centerOf(box);
            return insideBox({ x0: c.x, y0: c.y, x1: c.x, y1: c.y }, plot.box);
        }
        return insideBox(box, plot.box);
    }
    if (mode === 'center') {
        const c = centerOf(box);
        return Math.hypot(c.x - plot.cx, c.y - plot.cy) <= plot.r + TOLERANCE;
    }
    return insideBox(box, {
        x0: plot.cx - plot.r,
        y0: plot.cy - plot.r,
        x1: plot.cx + plot.r,
        y1: plot.cy + plot.r,
    });
}

function nonFiniteAttributes(svg: SVGSVGElement): string[] {
    const found: string[] = [];
    for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
        for (const attr of Array.from(el.attributes)) {
            if (/NaN|Infinity/.test(attr.value)) {
                found.push(`<${el.tagName.toLowerCase()} ${attr.name}="${attr.value.slice(0, 80)}">`);
            }
        }
    }
    return found;
}

function viewBoxOf(svg: SVGSVGElement): Box {
    const vb = svg.viewBox.baseVal;
    return { x0: vb.x, y0: vb.y, x1: vb.x + vb.width, y1: vb.y + vb.height };
}

// ---------------------------------------------------------------------------
// Per-chart table: how each class becomes that chart's input, which elements
// are marks, and what the plot area is.
// ---------------------------------------------------------------------------

interface MarkSpec {
    selector: string;
    mode: 'bbox' | 'center';
}

type PlotSource = 'chart-area' | 'grid' | 'view-box' | 'pie' | 'radar';

interface ChartCase {
    label: string;
    type: Type<unknown>;
    inputs: (cls: DataClass) => Record<string, unknown>;
    marks: MarkSpec[];
    plot: PlotSource;
    /** Selector of the gridlines whose coordinates must lie in the plot (cartesian charts only). */
    gridlines?: string;
    /** Classes for which an empty chart is the defined outcome (pie with no positive value). */
    mayBeEmpty?: (cls: DataClass) => boolean;
    /** Per-class element count that must equal the number of data points (T-2). */
    pointMark?: string;
    /** The axis the categories run along; `'x'` unless the chart stacks them down the page. */
    categoryAxis?: 'x' | 'y';
    /** The data classes the chart is not defined on (e.g. a shared-label axis). */
    skip?: (cls: DataClass) => string | false;
}

const points = (cls: DataClass): { name: string; value: number }[] =>
    cls.values.map((value, i) => ({ name: cls.names[i], value }));

const seriesOf = (cls: DataClass): { name: string; data: { name: string; value: number }[] }[] => [
    { name: 'A', data: points(cls) },
    { name: 'B', data: points(cls).map(p => ({ name: p.name, value: p.value / 2 })) },
];

const BAR_MARKS: MarkSpec[] = [{ selector: 'g[role="button"] > rect', mode: 'bbox' }];
const CHART_AREA_GRID = 'g.text-border > line';
const SLOT_GRID = 'line[stroke-dasharray="2 3"]';
const hasNoPositive = (cls: DataClass): boolean => cls.values.every(v => v <= 0);

const CHARTS: ChartCase[] = [
    { label: 'bar (vertical)', type: BarChartComponent, inputs: c => ({ data: points(c) }), marks: BAR_MARKS, plot: 'chart-area', gridlines: CHART_AREA_GRID, pointMark: 'g[role="button"] > rect' },
    { label: 'bar (horizontal)', type: BarChartComponent, inputs: c => ({ data: points(c), orientation: 'horizontal' }), marks: BAR_MARKS, plot: 'chart-area', gridlines: CHART_AREA_GRID, pointMark: 'g[role="button"] > rect', categoryAxis: 'y' },
    { label: 'bar (RTL)', type: BarChartComponent, inputs: c => ({ data: points(c), dir: 'rtl' }), marks: BAR_MARKS, plot: 'chart-area', gridlines: CHART_AREA_GRID, pointMark: 'g[role="button"] > rect' },
    { label: 'bar (horizontal RTL)', type: BarChartComponent, inputs: c => ({ data: points(c), orientation: 'horizontal', dir: 'rtl' }), marks: BAR_MARKS, plot: 'chart-area', gridlines: CHART_AREA_GRID, pointMark: 'g[role="button"] > rect', categoryAxis: 'y' },
    { label: 'bar-drilldown', type: BarChartDrilldownComponent, inputs: c => ({ data: points(c) }), marks: BAR_MARKS, plot: 'chart-area', gridlines: CHART_AREA_GRID, pointMark: 'g[role="button"] > rect' },
    { label: 'bar-drilldown (RTL)', type: BarChartDrilldownComponent, inputs: c => ({ data: points(c), dir: 'rtl' }), marks: BAR_MARKS, plot: 'chart-area', gridlines: CHART_AREA_GRID, pointMark: 'g[role="button"] > rect' },
    { label: 'stacked-bar (absolute)', type: StackedBarChartComponent, inputs: c => ({ series: seriesOf(c), categories: c.names }), marks: BAR_MARKS, plot: 'chart-area', gridlines: CHART_AREA_GRID, pointMark: 'g[role="button"] > rect' },
    { label: 'stacked-bar (percent)', type: StackedBarChartComponent, inputs: c => ({ series: seriesOf(c), categories: c.names, stacking: 'percent' }), marks: BAR_MARKS, plot: 'chart-area', gridlines: CHART_AREA_GRID, pointMark: 'g[role="button"] > rect' },
    { label: 'stacked-bar (RTL)', type: StackedBarChartComponent, inputs: c => ({ series: seriesOf(c), categories: c.names, dir: 'rtl' }), marks: BAR_MARKS, plot: 'chart-area', gridlines: CHART_AREA_GRID, pointMark: 'g[role="button"] > rect' },
    {
        label: 'column-range',
        type: ColumnRangeChartComponent,
        inputs: c => ({ data: c.values.map((v, i) => ({ name: c.names[i], low: v * 0.5, high: v * 1.5 })) }),
        marks: BAR_MARKS, plot: 'chart-area', gridlines: CHART_AREA_GRID, pointMark: 'g[role="button"] > rect',
    },
    {
        label: 'column-range (RTL)',
        type: ColumnRangeChartComponent,
        inputs: c => ({ data: c.values.map((v, i) => ({ name: c.names[i], low: v, high: v - Math.abs(v) - 1 })), dir: 'rtl' }),
        marks: BAR_MARKS, plot: 'chart-area', gridlines: CHART_AREA_GRID, pointMark: 'g[role="button"] > rect',
    },
    {
        label: 'bar-race',
        type: BarRaceChartComponent,
        inputs: c => ({ frames: [points(c), points(c).map(p => ({ name: p.name, value: p.value * 1.2 }))] }),
        marks: [{ selector: 'svg[role="img"] rect', mode: 'bbox' }], plot: 'chart-area',
        // Names are the entity identity across frames; duplicates collapse to the last entry (§3.4).
        skip: c => (c.id === 'duplicate-labels' ? 'name is identity in bar-race' : false),
    },
    {
        label: 'bar-race (RTL)',
        type: BarRaceChartComponent,
        inputs: c => ({ frames: [points(c)], dir: 'rtl' }),
        marks: [{ selector: 'svg[role="img"] rect', mode: 'bbox' }], plot: 'chart-area',
        skip: c => (c.id === 'duplicate-labels' ? 'name is identity in bar-race' : false),
    },
    { label: 'line', type: LineChartComponent, inputs: c => ({ series: seriesOf(c) }), marks: [{ selector: 'path[data-slot="line-series"]', mode: 'bbox' }, { selector: 'svg circle', mode: 'center' }], plot: 'grid', gridlines: SLOT_GRID },
    { label: 'line (RTL)', type: LineChartComponent, inputs: c => ({ series: seriesOf(c), dir: 'rtl' }), marks: [{ selector: 'path[data-slot="line-series"]', mode: 'bbox' }], plot: 'grid', gridlines: SLOT_GRID },
    { label: 'area (overlaid)', type: AreaChartComponent, inputs: c => ({ series: seriesOf(c) }), marks: [{ selector: 'path[data-slot="area-series"]', mode: 'bbox' }], plot: 'grid', gridlines: SLOT_GRID },
    { label: 'area (stacked)', type: AreaChartComponent, inputs: c => ({ series: seriesOf(c), stacked: true }), marks: [{ selector: 'path[data-slot="area-series"]', mode: 'bbox' }], plot: 'grid', gridlines: SLOT_GRID },
    { label: 'area (percent)', type: AreaChartComponent, inputs: c => ({ series: seriesOf(c), stacked: true, stackingMode: 'percent' }), marks: [{ selector: 'path[data-slot="area-series"]', mode: 'bbox' }], plot: 'grid', gridlines: SLOT_GRID },
    { label: 'area (RTL)', type: AreaChartComponent, inputs: c => ({ series: seriesOf(c), dir: 'rtl' }), marks: [{ selector: 'path[data-slot="area-series"]', mode: 'bbox' }], plot: 'grid', gridlines: SLOT_GRID },
    {
        label: 'combo',
        type: ComboChartComponent,
        inputs: c => ({ barSeries: [seriesOf(c)[0]], lineSeries: [seriesOf(c)[1]] }),
        marks: [{ selector: 'rect[data-slot="combo-bar"]', mode: 'bbox' }, { selector: 'path[data-slot="combo-line"]', mode: 'bbox' }],
        plot: 'grid', gridlines: SLOT_GRID, pointMark: 'rect[data-slot="combo-bar"]',
    },
    {
        label: 'scatter',
        type: ScatterChartComponent,
        inputs: c => ({ series: [{ name: 'S', points: c.values.map((v, i) => ({ x: i, y: v })) }] }),
        marks: [{ selector: 'circle[data-slot="scatter-point"]', mode: 'center' }], plot: 'grid', gridlines: SLOT_GRID,
    },
    {
        label: 'bubble',
        type: BubbleChartComponent,
        inputs: c => ({ series: [{ name: 'S', points: c.values.map((v, i) => ({ x: i, y: v, z: Math.abs(v) + 1 })) }] }),
        marks: [{ selector: 'circle[data-slot="bubble-point"]', mode: 'center' }], plot: 'grid', gridlines: SLOT_GRID,
    },
    {
        label: 'waterfall',
        type: WaterfallChartComponent,
        inputs: c => ({ data: points(c) }),
        marks: [{ selector: 'rect[data-slot="waterfall-bar"]', mode: 'bbox' }], plot: 'grid', gridlines: SLOT_GRID,
        pointMark: 'rect[data-slot="waterfall-bar"]',
    },
    {
        label: 'boxplot',
        type: BoxplotComponent,
        inputs: c => {
            const spread = (v: number): number => Math.abs(v) * 0.1 || 1;
            return { groups: c.values.map((v, i) => ({ label: c.names[i], values: [v - 2 * spread(v), v - spread(v), v, v + spread(v), v + 2 * spread(v)] })) };
        },
        marks: [
            { selector: 'g[data-slot="boxplot-box"] > rect', mode: 'bbox' },
            { selector: 'line[data-slot="boxplot-whisker"]', mode: 'bbox' },
            { selector: 'circle[data-slot="boxplot-outlier"]', mode: 'center' },
        ],
        plot: 'grid', gridlines: SLOT_GRID, pointMark: 'g[data-slot="boxplot-box"] > rect',
    },
    {
        label: 'candlestick',
        type: CandlestickComponent,
        inputs: c => {
            const d = Math.abs(c.values[0] ?? 1) * 0.2 || 1;
            return { points: c.values.map((v, i) => ({ date: c.names[i], open: v, high: v + d, low: v - d, close: v + d / 2 })) };
        },
        marks: [{ selector: 'rect[data-slot="candlestick-body"]', mode: 'bbox' }, { selector: 'line[data-slot="candlestick-wick"]', mode: 'bbox' }],
        plot: 'grid', gridlines: SLOT_GRID, pointMark: 'rect[data-slot="candlestick-body"]',
    },
    {
        label: 'histogram',
        type: HistogramComponent,
        inputs: c => ({ values: c.values }),
        marks: [{ selector: 'g[data-slot="histogram-bar"] > rect', mode: 'bbox' }], plot: 'grid', gridlines: SLOT_GRID,
    },
    {
        label: 'heatmap',
        type: HeatmapComponent,
        inputs: c => ({ data: c.values.map((v, i) => ({ row: `r${i % 2}`, col: `c${i}`, value: v })) }),
        marks: [{ selector: 'rect[data-slot="heatmap-cell"]', mode: 'bbox' }], plot: 'view-box',
    },
    {
        label: 'calendar-heatmap',
        type: CalendarHeatmapComponent,
        inputs: c => ({ data: c.values.map((v, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, value: v })) }),
        marks: [{ selector: 'rect[data-slot="calendar-day"]', mode: 'bbox' }], plot: 'view-box',
    },
    {
        label: 'funnel',
        type: FunnelChartComponent,
        inputs: c => ({ data: points(c) }),
        marks: [{ selector: 'polygon[data-slot="funnel-stage"]', mode: 'bbox' }], plot: 'view-box',
        pointMark: 'polygon[data-slot="funnel-stage"]', categoryAxis: 'y',
    },
    {
        label: 'pie',
        type: PieChartComponent,
        inputs: c => ({ data: points(c) }),
        marks: [{ selector: 'g[role="button"] > path', mode: 'bbox' }], plot: 'pie', mayBeEmpty: hasNoPositive,
    },
    {
        label: 'donut',
        type: PieChartComponent,
        inputs: c => ({ data: points(c), innerRadius: 0.6 }),
        marks: [{ selector: 'g[role="button"] > path', mode: 'bbox' }], plot: 'pie', mayBeEmpty: hasNoPositive,
    },
    {
        label: 'pie-drilldown',
        type: PieChartDrilldownComponent,
        inputs: c => ({ data: points(c) }),
        marks: [{ selector: 'g[role="button"] > path', mode: 'bbox' }], plot: 'pie', mayBeEmpty: hasNoPositive,
    },
    {
        label: 'radar',
        type: RadarChartComponent,
        inputs: c => ({ series: seriesOf(c) }),
        marks: [{ selector: 'circle[role="button"]', mode: 'center' }], plot: 'radar',
    },
    {
        label: 'radar (explicit maxValue below the data)',
        type: RadarChartComponent,
        inputs: c => ({ series: seriesOf(c), maxValueInput: 1 }),
        marks: [{ selector: 'circle[role="button"]', mode: 'center' }], plot: 'radar',
    },
    {
        label: 'gauge',
        type: GaugeChartComponent,
        inputs: c => ({ value: c.values[0] }),
        marks: [{ selector: 'path', mode: 'bbox' }], plot: 'view-box',
    },
    {
        label: 'bullet',
        type: BulletChartComponent,
        inputs: c => ({ value: c.values[0], target: c.values[1] ?? c.values[0], ranges: [Math.abs(c.values[0]) || 1] }),
        marks: [{ selector: 'rect[data-slot="bullet-measure"]', mode: 'bbox' }], plot: 'view-box',
    },
    {
        label: 'treemap',
        type: TreemapComponent,
        inputs: c => ({ nodes: c.values.map((v, i) => ({ label: c.names[i], value: v })) }),
        marks: [{ selector: 'g[data-slot="treemap-cell"] > rect', mode: 'bbox' }], plot: 'view-box',
        mayBeEmpty: hasNoPositive,
    },
];

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const fixtures: ComponentFixture<unknown>[] = [];

async function render(chart: ChartCase, cls: DataClass): Promise<ComponentFixture<unknown>> {
    const fixture = TestBed.createComponent(chart.type);
    fixtures.push(fixture);
    (fixture.nativeElement as HTMLElement).style.width = '520px';
    document.body.append(fixture.nativeElement);
    for (const [name, value] of Object.entries(chart.inputs(cls))) {
        fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
}

afterEach(() => {
    for (const fixture of fixtures.splice(0)) fixture.destroy();
});

/** The chart's own SVG: toolbars (bar-race's play button) carry small icon SVGs ahead of it. */
function findSvg(fixture: ComponentFixture<unknown>): SVGSVGElement | undefined {
    const area = (svg: SVGSVGElement): number => svg.viewBox.baseVal.width * svg.viewBox.baseVal.height;
    const svgs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('svg'));
    return svgs.reduce<SVGSVGElement | undefined>((best, svg) => (!best || area(svg) > area(best) ? svg : best), undefined);
}

function rootSvg(fixture: ComponentFixture<unknown>): SVGSVGElement {
    const svg = findSvg(fixture);
    if (!svg) throw new Error('chart rendered no <svg>');
    return svg;
}

function gridBox(svg: SVGSVGElement, selector: string): Box | undefined {
    const lines = Array.from(svg.querySelectorAll<SVGGraphicsElement>(selector));
    if (lines.length === 0) return undefined;
    const boxes = lines.map(l => rootBox(l, svg));
    return {
        x0: Math.min(...boxes.map(b => b.x0)),
        y0: Math.min(...boxes.map(b => b.y0)),
        x1: Math.max(...boxes.map(b => b.x1)),
        y1: Math.max(...boxes.map(b => b.y1)),
    };
}

const describeBox = (box: Box): string => `[${[box.x0, box.y0, box.x1, box.y1].map(n => n.toFixed(1)).join(', ')}]`;

function circlePlot(svg: SVGSVGElement, radius: number): Plot {
    const vb = viewBoxOf(svg);
    return { kind: 'circle', cx: (vb.x0 + vb.x1) / 2, cy: (vb.y0 + vb.y1) / 2, r: radius };
}

/** The plot rect, or `undefined` when the chart drew nothing to derive it from. */
function plotOf(chart: ChartCase, fixture: ComponentFixture<unknown>, svg: SVGSVGElement): Plot | undefined {
    const instance = fixture.componentInstance as Record<string, unknown>;
    switch (chart.plot) {
        case 'chart-area': {
            const area = (instance['chartArea'] as () => { left: number; right: number; top: number; bottom: number })();
            return { kind: 'rect', box: { x0: area.left, y0: area.top, x1: area.right, y1: area.bottom } };
        }
        case 'grid': {
            const box = chart.gridlines ? gridBox(svg, chart.gridlines) : undefined;
            return box && { kind: 'rect', box };
        }
        case 'view-box':
            return { kind: 'rect', box: viewBoxOf(svg) };
        case 'pie':
            return circlePlot(svg, (instance['outerRadius'] as () => number)());
        case 'radar':
            return circlePlot(svg, (instance['radius'] as () => number)());
    }
}

/** Marks that fall outside `plot`, plus how many marks were found. */
function markViolations(chart: ChartCase, svg: SVGSVGElement, plot: Plot): { out: string[]; count: number } {
    const out: string[] = [];
    let count = 0;
    for (const { selector, mode } of chart.marks) {
        const drawn = Array.from(svg.querySelectorAll<SVGGraphicsElement>(selector))
            .filter(el => el.tagName !== 'path' || el.getAttribute('d'));
        count += drawn.length;
        for (const el of drawn) {
            const box = rootBox(el, svg);
            if (!inside(box, plot, mode)) out.push(`${selector} outside plot: ${describeBox(box)} vs ${JSON.stringify(plot)}`);
        }
    }
    return { out, count };
}

/**
 * A usable value axis: at least two gridlines, all inside the plot. Where the
 * plot is derived from the gridlines themselves, they must at least stay
 * inside the viewBox.
 */
function gridlineViolations(chart: ChartCase, svg: SVGSVGElement, plot: Plot): string[] {
    if (!chart.gridlines || plot.kind !== 'rect') return [];
    const lines = Array.from(svg.querySelectorAll<SVGGraphicsElement>(chart.gridlines)).map(line => rootBox(line, svg));
    const bounds = chart.plot === 'chart-area' ? plot.box : viewBoxOf(svg);
    const out = lines.filter(box => !insideBox(box, bounds)).map(box => `gridline outside plot: ${describeBox(box)}`);
    if (lines.length < 2) out.push(`only ${lines.length} gridline(s) rendered`);
    return out;
}

function violations(chart: ChartCase, cls: DataClass, fixture: ComponentFixture<unknown>): string[] {
    const svg = findSvg(fixture);
    if (!svg) return chart.mayBeEmpty?.(cls) ? [] : ['no <svg> rendered'];
    const out = nonFiniteAttributes(svg).map(a => `non-finite attribute ${a}`);
    const plot = plotOf(chart, fixture, svg);
    if (!plot) return [...out, 'no gridlines rendered'];

    const marks = markViolations(chart, svg, plot);
    if (marks.count === 0 && !chart.mayBeEmpty?.(cls)) out.push('no marks rendered');
    return [...out, ...marks.out, ...gridlineViolations(chart, svg, plot)];
}

// ---------------------------------------------------------------------------
// T-1
// ---------------------------------------------------------------------------

describe('every chart renders every finite data class with marks inside the plot and no NaN', () => {
    // A class whose values do not depend on the seed (all-zero, all-equal, ...) runs once.
    const seen = new Set<string>();
    const cases = CHARTS.flatMap(chart =>
        SEEDS.flatMap(seed => dataClasses(seed).map(cls => ({ chart, seed, cls }))),
    ).filter(({ chart, cls }) => {
        const key = `${chart.label}|${cls.id}|${JSON.stringify(cls.values)}|${cls.names.join()}`;
        const fresh = !seen.has(key);
        seen.add(key);
        return fresh && !chart.skip?.(cls);
    });

    for (const { chart, seed, cls } of cases) {
        it(`${chart.label} / ${cls.id} / seed ${seed}`, async () => {
            const fixture = await render(chart, cls);
            const found = violations(chart, cls, fixture);
            expect(found.join('\n'), `values ${JSON.stringify(cls.values)}`).toBe('');
        });
    }
});

// ---------------------------------------------------------------------------
// T-2
// ---------------------------------------------------------------------------

const DUPLICATE_CASES = CHARTS.filter(c => c.pointMark);
const DUP_LABELS = dataClasses(1).find(c => c.id === 'duplicate-labels') as DataClass;
const DUP_VALUES = dataClasses(1).find(c => c.id === 'duplicate-values') as DataClass;
const ALL_EQUAL = dataClasses(1).find(c => c.id === 'all-equal') as DataClass;

function duplicateKeyWarnings(spy: { mock: { calls: unknown[][] } }): string[] {
    return spy.mock.calls.map(args => args.map(String).join(' ')).filter(text => text.includes('NG0955'));
}

/**
 * Angular reports a duplicate `@for` key only when it reconciles against
 * existing nodes (D-21), so a chart is re-fed fresh arrays and re-checked.
 */
function rerender(fixture: ComponentFixture<unknown>, inputs: Record<string, unknown>): void {
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
}

/** Runs `body` with the console spied and fails if NG0955 was logged. */
async function expectNoDuplicateKeys(body: () => Promise<void>): Promise<void> {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
        await body();
        expect([...duplicateKeyWarnings(warn), ...duplicateKeyWarnings(error)]).toEqual([]);
    } finally {
        warn.mockRestore();
        error.mockRestore();
    }
}

/** Two series that share one name and have no `id`. */
const sameNamedSeries = (c: DataClass): { name: string; data: { name: string; value: number }[] }[] => [
    { name: 'A', data: points(c) },
    { name: 'A', data: points(c).map(p => ({ name: p.name, value: p.value / 2 })) },
];

describe('duplicate labels and values give one mark per point at its own position, without NG0955', () => {
    for (const chart of DUPLICATE_CASES) {
        for (const cls of [DUP_LABELS, DUP_VALUES]) {
            it(`${chart.label} / ${cls.id}`, () => expectNoDuplicateKeys(async () => {
                    const fixture = await render(chart, cls);
                    rerender(fixture, chart.inputs(cls));
                    const svg = rootSvg(fixture);
                    const marks = Array.from(svg.querySelectorAll<SVGGraphicsElement>(chart.pointMark as string));
                    // A stacked bar draws one segment per series in each category.
                    const perCategory = chart.label.startsWith('stacked-bar') ? 2 : 1;
                    expect(marks).toHaveLength(cls.values.length * perCategory);

                    // RTL mirrors a category axis that runs along x; a vertical one still runs top to bottom.
                    const rtl = chart.label.includes('RTL') && chart.categoryAxis !== 'y';
                    const centres = marks
                        .filter((_, i) => i % perCategory === 0)
                        .map(m => centerOf(rootBox(m, svg)))
                        .map(c => (chart.categoryAxis === 'y' ? c.y : c.x));
                    for (let i = 1; i < centres.length; i++) {
                        expect(rtl ? centres[i] < centres[i - 1] : centres[i] > centres[i - 1]).toBe(true);
                    }
            }));
        }
    }

    for (const [label, type, inputs] of [
        ['line', LineChartComponent, (c: DataClass) => ({ series: seriesOf(c) })],
        ['area', AreaChartComponent, (c: DataClass) => ({ series: seriesOf(c) })],
        ['radar', RadarChartComponent, (c: DataClass) => ({ series: seriesOf(c) })],
        ['funnel', FunnelChartComponent, (c: DataClass) => ({ data: points(c) })],
        // Two equal outliers per group: boxplot keys its outlier circles by value.
        ['boxplot', BoxplotComponent, (c: DataClass) => ({ groups: c.values.map((_, i) => ({ label: c.names[i], values: [10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 100, 100] })) })],
        ['heatmap', HeatmapComponent, (c: DataClass) => ({ data: c.values.map((v, i) => ({ row: 'r', col: c.names[i], value: v })) })],
        ['combo', ComboChartComponent, (c: DataClass) => ({ barSeries: [seriesOf(c)[0]] })],
    ] as [string, Type<unknown>, (c: DataClass) => Record<string, unknown>][]) {
        it(`${label} logs no NG0955 for duplicate labels, duplicate values and equal values`, () => expectNoDuplicateKeys(async () => {
            for (const cls of [DUP_LABELS, DUP_VALUES, ALL_EQUAL]) {
                const fixture = await render({ label, type, inputs, marks: [], plot: 'view-box' }, cls);
                rerender(fixture, inputs(cls));
            }
        }));
    }

    // Series with one name and no id share a legend key, a tooltip row label and a polygon key.
    for (const [label, type, inputs] of [
        ['line', LineChartComponent, (c: DataClass) => ({ series: sameNamedSeries(c) })],
        ['area', AreaChartComponent, (c: DataClass) => ({ series: sameNamedSeries(c) })],
        ['radar', RadarChartComponent, (c: DataClass) => ({ series: sameNamedSeries(c) })],
        ['stacked-bar', StackedBarChartComponent, (c: DataClass) => ({ series: sameNamedSeries(c), categories: c.names })],
        ['combo', ComboChartComponent, (c: DataClass) => ({ barSeries: sameNamedSeries(c).slice(0, 1), lineSeries: sameNamedSeries(c).slice(1) })],
    ] as [string, Type<unknown>, (c: DataClass) => Record<string, unknown>][]) {
        it(`${label} logs no NG0955 for same-named series`, () => expectNoDuplicateKeys(async () => {
            const fixture = await render({ label, type, inputs, marks: [], plot: 'view-box' }, ALL_EQUAL);
            // The tooltip lists one row per series, labelled by series name.
            (fixture.componentInstance as { setHover?: (i: number) => void }).setHover?.(0);
            fixture.detectChanges();
            rerender(fixture, inputs(ALL_EQUAL));
        }));
    }

    it('heatmap keeps the cells ("a-b", "c") and ("a", "b-c") apart without NG0955', () => expectNoDuplicateKeys(async () => {
        const data = (): { row: string; col: string; value: number }[] => [
            { row: 'a-b', col: 'c', value: 1 },
            { row: 'a', col: 'b-c', value: 2 },
        ];
        const chart: ChartCase = { label: 'heatmap', type: HeatmapComponent, inputs: () => ({ data: data() }), marks: [], plot: 'view-box' };
        const fixture = await render(chart, ALL_EQUAL);
        rerender(fixture, { data: data() });
        expect(fixture.nativeElement.querySelectorAll('rect[data-slot="heatmap-cell"]')).toHaveLength(2);
    }));
});

// ---------------------------------------------------------------------------
// T-3
// ---------------------------------------------------------------------------

describe('every chart root carries its data-slot', () => {
    const slots: [string, Type<unknown>, Record<string, unknown>][] = [
        ['bar-chart', BarChartComponent, { data: [{ name: 'A', value: 1 }] }],
        ['bar-chart-drilldown', BarChartDrilldownComponent, { data: [{ name: 'A', value: 1 }] }],
        ['bar-race-chart', BarRaceChartComponent, { frames: [[{ name: 'A', value: 1 }]] }],
        ['column-range-chart', ColumnRangeChartComponent, { data: [{ name: 'A', low: 1, high: 2 }] }],
        ['pie-chart', PieChartComponent, { data: [{ name: 'A', value: 1 }] }],
        ['pie-chart-drilldown', PieChartDrilldownComponent, { data: [{ name: 'A', value: 1 }] }],
        ['stacked-bar-chart', StackedBarChartComponent, { series: [{ name: 'S', data: [{ name: 'A', value: 1 }] }], categories: ['A'] }],
        ['org-chart', OrgChartComponent, { data: [{ id: 'root', name: 'Root' }] }],
        ['line-chart', LineChartComponent, { series: [{ name: 'S', data: [{ name: 'A', value: 1 }] }] }],
        ['area-chart', AreaChartComponent, { series: [{ name: 'S', data: [{ name: 'A', value: 1 }] }] }],
        ['combo-chart', ComboChartComponent, { barSeries: [{ name: 'S', data: [{ name: 'A', value: 1 }] }] }],
        ['funnel-chart', FunnelChartComponent, { data: [{ name: 'A', value: 1 }] }],
        ['radar-chart', RadarChartComponent, { series: [{ name: 'S', data: [{ name: 'A', value: 1 }] }] }],
        ['scatter-chart', ScatterChartComponent, { series: [{ name: 'S', points: [{ x: 1, y: 1 }] }] }],
        ['bubble-chart', BubbleChartComponent, { series: [{ name: 'S', points: [{ x: 1, y: 1, z: 1 }] }] }],
        ['waterfall-chart', WaterfallChartComponent, { data: [{ name: 'A', value: 1 }] }],
        ['boxplot', BoxplotComponent, { groups: [{ label: 'A', values: [1, 2, 3] }] }],
        ['candlestick', CandlestickComponent, { points: [{ date: 'A', open: 1, high: 3, low: 0, close: 2 }] }],
        ['histogram', HistogramComponent, { values: [1, 2, 3] }],
        ['heatmap', HeatmapComponent, { data: [{ row: 'r', col: 'c', value: 1 }] }],
        ['calendar-heatmap', CalendarHeatmapComponent, { data: [{ date: '2024-01-01', value: 1 }] }],
        ['gauge-chart', GaugeChartComponent, { value: 1 }],
        ['bullet-chart', BulletChartComponent, { value: 1 }],
        ['treemap', TreemapComponent, { nodes: [{ label: 'A', value: 1 }] }],
    ];
    for (const [slot, type, inputs] of slots) {
        it(slot, () => {
            const fixture = TestBed.createComponent(type);
            fixtures.push(fixture);
            for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
            fixture.detectChanges();
            // The root is the host itself or the element it renders around everything else.
            const host = fixture.nativeElement as HTMLElement;
            const root = [host, host.firstElementChild].find(el => el?.getAttribute('data-slot') === slot);
            expect(root, `the root of <${host.localName}> has no data-slot="${slot}"`).toBeDefined();
        });
    }
});

describe('legacy tooltips stay inside a 320px viewport', () => {
    const LONG = 'W'.repeat(200);
    const tooltips: [string, Type<unknown>, Record<string, unknown>, string][] = [
        ['bar-chart', BarChartComponent, { data: [{ name: LONG, value: 4 }, { name: 'B', value: 2 }] }, 'g[role="button"]'],
        ['bar-chart-drilldown', BarChartDrilldownComponent, { data: [{ name: LONG, value: 4 }, { name: 'B', value: 2 }] }, 'g[role="button"]'],
        ['column-range-chart', ColumnRangeChartComponent, { data: [{ name: LONG, low: 1, high: 4 }, { name: 'B', low: 2, high: 3 }] }, 'g[role="button"]'],
        ['pie-chart', PieChartComponent, { data: [{ name: LONG, value: 4 }, { name: 'B', value: 2 }] }, 'g[role="button"]'],
        ['pie-chart-drilldown', PieChartDrilldownComponent, { data: [{ name: LONG, value: 4 }, { name: 'B', value: 2 }] }, 'g[role="button"]'],
        ['stacked-bar-chart', StackedBarChartComponent, { series: [{ name: LONG, data: [{ name: 'A', value: 4 }] }], categories: ['A'] }, 'g[role="button"]'],
    ];
    const original: [number, number] = [globalThis.innerWidth, globalThis.innerHeight];

    afterEach(async () => {
        await page.viewport(...original);
    });

    for (const [slot, type, inputs, target] of tooltips) {
        it(slot, async () => {
            await page.viewport(320, 700);
            const fixture = TestBed.createComponent(type);
            fixtures.push(fixture);
            document.body.append(fixture.nativeElement);
            for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
            fixture.detectChanges();
            const mark = (fixture.nativeElement as HTMLElement).querySelector(target);
            mark?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
            fixture.detectChanges();
            await fixture.whenStable();
            const tooltip = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('div.absolute.z-50');
            expect(tooltip, 'tooltip did not open').not.toBeNull();
            expect(tooltip?.textContent, 'the tooltip is not the long-label one').toContain(LONG);
            const width = tooltip?.getBoundingClientRect().width ?? Number.NaN;
            expect(width, `tooltip width at a ${globalThis.innerWidth}px viewport`).toBeLessThanOrEqual(globalThis.innerWidth - 32);
        });
    }
});
