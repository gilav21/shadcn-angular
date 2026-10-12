import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PieChartComponent } from './pie-chart.component';
import { ChartDataPoint } from '../../lib/chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('PieChartComponent', () => {
    let component: PieChartComponent;
    let fixture: ComponentFixture<PieChartComponent>;

    const sampleData: ChartDataPoint[] = [
        { name: 'Apples', value: 40 },
        { name: 'Bananas', value: 30 },
        { name: 'Cherries', value: 30 },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PieChartComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PieChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
    });

    it('should set aria-label on container', () => {
        const container = fixture.nativeElement.querySelector('[role="group"]');
        expect(container).toBeTruthy();
        expect(container.getAttribute('aria-label')).toContain('Pie chart');
    });

    it('should compute correct percentages for slices', () => {
        const slices = component.slices();
        expect(slices[0].percentage).toBe(40);
        expect(slices[1].percentage).toBe(30);
        expect(slices[2].percentage).toBe(30);
    });

    it('should emit sliceClick when onSliceClick is called', () => {
        let emitted: unknown;
        component.sliceClick.subscribe(val => emitted = val);

        const slice = component.slices()[0];
        const event = new MouseEvent('click');
        component.onSliceClick(event, slice);

        expect(emitted).toBeDefined();
        expect((emitted as { point: ChartDataPoint; index: number }).point).toEqual({ name: 'Apples', value: 40 });
        expect((emitted as { point: ChartDataPoint; index: number }).index).toBe(0);
    });

    it('should set hoveredIndex and emit sliceHover on onSliceHover', () => {
        let emitted: unknown;
        component.sliceHover.subscribe(val => emitted = val);

        const slice = component.slices()[1];
        component.onSliceHover(slice);

        expect(component.hoveredIndex()).toBe(1);
        expect(emitted).toBeDefined();
        expect((emitted as { point: ChartDataPoint; index: number }).point).toEqual({ name: 'Bananas', value: 30 });
    });

    it('should return hoveredSlice computed after hover', () => {
        expect(component.hoveredSlice()).toBeNull();

        const slice = component.slices()[2];
        component.onSliceHover(slice);

        const hovered = component.hoveredSlice();
        expect(hovered).toBeTruthy();
        expect(hovered!.data.name).toBe('Cherries');
        expect(hovered!.percentage).toBe(30);
    });

    it('should reset hoveredIndex and emit null on onSliceLeave', () => {
        let emitted: unknown = 'not-set';
        component.sliceHover.subscribe(val => emitted = val);

        const slice = component.slices()[0];
        component.onSliceHover(slice);
        expect(component.hoveredIndex()).toBe(0);

        component.onSliceLeave();
        expect(component.hoveredIndex()).toBeNull();
        expect(emitted).toBeNull();
        expect(component.hoveredSlice()).toBeNull();
    });

    it('should render legend buttons when showLegend is true', () => {
        fixture.componentRef.setInput('showLegend', true);
        fixture.componentRef.setInput('legendPosition', 'right');
        fixture.detectChanges();

        const buttons = fixture.nativeElement.querySelectorAll('button');
        expect(buttons).toHaveLength(3);
    });

    it('should not render legend buttons when legendPosition is none', () => {
        fixture.componentRef.setInput('legendPosition', 'none');
        fixture.detectChanges();

        const buttons = fixture.nativeElement.querySelectorAll('button');
        expect(buttons).toHaveLength(0);
    });

    it('should return empty slices for empty data', () => {
        fixture.componentRef.setInput('data', []);
        fixture.detectChanges();

        expect(component.slices()).toEqual([]);
    });

    it('should return empty slices when total is zero', () => {
        fixture.componentRef.setInput('data', [{ name: 'A', value: 0 }]);
        fixture.detectChanges();

        expect(component.total()).toBe(0);
        expect(component.slices()).toEqual([]);
    });
});

describe('PieChartComponent non-positive values', () => {
    const CLASSES: Record<string, number[]> = {
        'positive with a refund and a zero': [100, -30, 0, 50],
        'positive and negative that sum to zero': [50, -50],
        'all zero': [0, 0],
        'a single negative': [-5],
    };

    function build(values: number[]): ComponentFixture<PieChartComponent> {
        const fixture = TestBed.createComponent(PieChartComponent);
        fixture.componentRef.setInput('data', values.map((value, i) => ({ name: `Item ${i}`, value })));
        fixture.detectChanges();
        return fixture;
    }

    for (const [className, values] of Object.entries(CLASSES)) {
        const positive = values.filter(v => v > 0);

        it(`should draw a wedge only for each positive value (${className})`, () => {
            const fixture = build(values);
            const slices = fixture.componentInstance.slices();
            const total = positive.reduce((sum, v) => sum + v, 0);

            expect(slices.map(s => s.data.value)).toEqual(positive);
            slices.forEach((slice, i) => expect(slice.percentage).toBeCloseTo((positive[i] / total) * 100, 9));
            expect(fixture.nativeElement.querySelectorAll('g[role="button"]')).toHaveLength(positive.length);
            if (positive.length > 0) {
                const shown = slices.reduce((sum, s) => sum + s.percentage, 0);
                expect(Math.abs(shown - 100)).toBeLessThan(0.05);
            }
        });

        it(`should keep every entry in the legend with its raw value (${className})`, () => {
            const fixture = build(values);
            const rows = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];

            const cells = (row: HTMLElement): string[] =>
                Array.from(row.querySelectorAll('span')).slice(1).map(s => s.textContent?.trim() ?? '');

            expect(rows.map(cells)).toEqual(values.map((v, i) => [`Item ${i}`, String(v)]));
        });

        it(`should show the empty state only when no value is positive (${className})`, () => {
            const fixture = build(values);
            const empty = fixture.nativeElement.querySelector('[data-slot="pie-empty"]');

            expect(empty !== null).toBe(positive.length === 0);
        });
    }

    it('should lay the wedges end to end around exactly one turn, skipping entries without a wedge', () => {
        const slices = build([100, -30, 0, 50]).componentInstance.slices();

        expect(slices[1].startAngle).toBeCloseTo(slices[0].endAngle, 9);
        expect(slices[1].endAngle - slices[0].startAngle).toBeCloseTo(Math.PI * 2, 9);
    });

    it('should keep each wedge on its own palette colour when an earlier entry has no wedge', () => {
        const slices = build([-30, 40, 60]).componentInstance.slices();

        expect(slices.map(s => s.index)).toEqual([1, 2]);
        expect(slices[0].color).not.toBe(slices[1].color);
    });
});
