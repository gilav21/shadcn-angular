import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HeatmapComponent } from './heatmap.component';
import { HeatmapCell } from '../../lib/chart.types';

type ResizeObserverCtor = typeof globalThis.ResizeObserver;

describe('HeatmapComponent', () => {
    let component: HeatmapComponent;
    let fixture: ComponentFixture<HeatmapComponent>;

    const savedResizeObserver = (globalThis as unknown as { ResizeObserver?: ResizeObserverCtor })
        .ResizeObserver;

    const data: HeatmapCell[] = [
        { row: 'Mon', col: 'AM', value: 1 },
        { row: 'Mon', col: 'PM', value: 5 },
        { row: 'Tue', col: 'AM', value: 9 },
        { row: 'Tue', col: 'PM', value: 3 },
    ];

    beforeEach(async () => {
        class ResizeObserverStub {
            observe(): void {
                /* no-op under jsdom */
            }
            unobserve(): void {
                /* no-op under jsdom */
            }
            disconnect(): void {
                /* no-op under jsdom */
            }
        }
        (globalThis as unknown as { ResizeObserver: ResizeObserverCtor }).ResizeObserver =
            ResizeObserverStub as unknown as ResizeObserverCtor;

        await TestBed.configureTestingModule({
            imports: [HeatmapComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(HeatmapComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
    });

    afterEach(() => {
        (globalThis as unknown as { ResizeObserver?: ResizeObserverCtor }).ResizeObserver =
            savedResizeObserver;
    });

    it('renders with an accessible Heatmap label', () => {
        const c = fixture.nativeElement.querySelector('[role="group"]');
        expect(c.getAttribute('aria-label')).toContain('Heatmap with 2 rows and 2 columns');
    });

    it('prefixes the aria-label with the title when provided', () => {
        fixture.componentRef.setInput('title', 'Activity');
        fixture.detectChanges();
        expect(component.ariaLabel()).toBe(
            'Activity. Heatmap with 2 rows and 2 columns.',
        );
    });

    it('derives unique rows and columns in order of appearance', () => {
        expect(component.rows()).toEqual(['Mon', 'Tue']);
        expect(component.cols()).toEqual(['AM', 'PM']);
    });

    it('renders one cell per data point', () => {
        expect(
            fixture.nativeElement.querySelectorAll('rect[data-slot="heatmap-cell"]'),
        ).toHaveLength(4);
    });

    it('derives the value domain from the data', () => {
        expect(component.valueDomain()).toEqual([1, 9]);
    });

    it('maps the maximum value to the end color of the scale', () => {
        fixture.componentRef.setInput('fromColor', 'hsl(210, 90%, 95%)');
        fixture.componentRef.setInput('toColor', 'hsl(210, 90%, 35%)');
        fixture.detectChanges();
        expect(component.colorFor(9)).toBe('hsl(210, 90%, 35%)');
        expect(component.colorFor(1)).toBe('hsl(210, 90%, 95%)');
    });

    it('interpolates an intermediate value between the endpoint colors', () => {
        const mid = component.colorFor(5);
        expect(mid).toMatch(/^hsl\(/);
        expect(mid).not.toBe(component.colorFor(1));
        expect(mid).not.toBe(component.colorFor(9));
    });

    it('renders square cells (width equals height)', () => {
        for (const pc of component.placedCells()) {
            expect(pc.w).toBe(pc.h);
        }
    });

    it('positions cells on a grid keyed by row and column index', () => {
        const placed = component.placedCells();
        const tuePm = placed.find(p => p.cell.row === 'Tue' && p.cell.col === 'PM');
        const monAm = placed.find(p => p.cell.row === 'Mon' && p.cell.col === 'AM');
        expect(tuePm!.x).toBeGreaterThan(monAm!.x);
        expect(tuePm!.y).toBeGreaterThan(monAm!.y);
    });

    it('caps the cell size so cells do not stretch to fill a wide container', () => {
        fixture.componentRef.setInput('maxCellSize', 40);
        fixture.detectChanges();
        expect(component.cellSize()).toBeLessThanOrEqual(40);
    });

    it('computes grid geometry (used width, height and viewBox) from the cell size', () => {
        const size = component.cellSize();
        expect(component.usedWidth()).toBe(48 + 2 * (size + 2));
        expect(component.svgHeight()).toBe(22 + 2 * (size + 2));
        expect(component.viewBox()).toBe(`0 0 ${component.usedWidth()} ${component.svgHeight()}`);
    });

    it('places column and row labels at cell centres', () => {
        expect(component.colLabels().map(l => l.col)).toEqual(['AM', 'PM']);
        expect(component.rowLabels().map(l => l.row)).toEqual(['Mon', 'Tue']);
        const size = component.cellSize();
        expect(component.colLabels()[0].x).toBe(48 + size / 2);
        expect(component.rowLabels()[0].y).toBe(22 + size / 2);
    });

    it('builds five legend stops spanning the value domain', () => {
        const stops = component.legendStops();
        expect(stops).toHaveLength(5);
        expect(stops[0].value).toBe(1);
        expect(stops[4].value).toBe(9);
        expect(stops[0].color).toBe(component.colorFor(1));
    });

    it('builds a tooltip row and title for the hovered cell', () => {
        component.setHover({ row: 'Tue', col: 'AM', value: 9 });
        const rows = component.tooltipRows();
        expect(rows[0].value).toContain('9');
        expect(rows[0].label).toBe('AM');
        expect(component.hoverTitle()).toBe('Tue · AM');
    });

    it('has no tooltip rows or title when nothing is hovered', () => {
        expect(component.tooltipRows()).toHaveLength(0);
        expect(component.hoverTitle()).toBeUndefined();
    });

    it('sets the tooltip position from the placed cell on hover enter and clears on leave', () => {
        const placed = component.placedCells()[3];
        component.onCellEnter(placed);
        expect(component.hovered()).toBe(placed.cell);
        expect(component.tooltipPos().x).toBe(placed.x + placed.w / 2);
        expect(component.tooltipPos().y).toBe(Math.max(8, placed.y - 8));

        component.onLeave();
        expect(component.hovered()).toBeNull();
    });

    it('emits cellHover on hover changes', () => {
        const emitted: (HeatmapCell | null)[] = [];
        component.cellHover.subscribe(c => emitted.push(c));
        const cell: HeatmapCell = { row: 'Mon', col: 'PM', value: 5 };
        component.setHover(cell);
        component.setHover(null);
        expect(emitted).toEqual([cell, null]);
    });

    it('falls back to a default domain and max cell size for empty data', () => {
        fixture.componentRef.setInput('data', []);
        fixture.componentRef.setInput('maxCellSize', 52);
        fixture.detectChanges();
        expect(component.valueDomain()).toEqual([0, 1]);
        expect(component.cellSize()).toBe(52);
        expect(component.placedCells()).toHaveLength(0);
        expect(
            fixture.nativeElement.querySelectorAll('rect[data-slot="heatmap-cell"]'),
        ).toHaveLength(0);
    });

    it('hides the legend and tooltip when their inputs are disabled', () => {
        fixture.componentRef.setInput('showLegend', false);
        fixture.componentRef.setInput('showTooltip', false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('ui-chart-tooltip')).toBeNull();
    });

    it('renders cell value labels when showValues is enabled', () => {
        fixture.componentRef.setInput('showValues', true);
        fixture.detectChanges();
        const texts = Array.from(
            fixture.nativeElement.querySelectorAll('svg text'),
        ) as SVGTextElement[];
        expect(texts.some(t => t.textContent?.trim() === '9')).toBe(true);
    });
});
