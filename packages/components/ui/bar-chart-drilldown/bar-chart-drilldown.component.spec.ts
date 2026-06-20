import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartDrilldownComponent } from './bar-chart-drilldown.component';
import { DrilldownDataPoint, DrilldownSeries } from '../../lib/chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('BarChartDrilldownComponent', () => {
    let component: BarChartDrilldownComponent;
    let fixture: ComponentFixture<BarChartDrilldownComponent>;

    const sampleData: DrilldownDataPoint[] = [
        { name: 'Category A', value: 50, drilldown: 'a-detail' },
        { name: 'Category B', value: 30 },
    ];

    const sampleDrilldownSeries: DrilldownSeries[] = [
        {
            id: 'a-detail',
            name: 'Category A Details',
            data: [
                { name: 'Sub A1', value: 20 },
                { name: 'Sub A2', value: 15 },
                { name: 'Sub A3', value: 15 },
            ],
        },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BarChartDrilldownComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(BarChartDrilldownComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', sampleDrilldownSeries);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should compute bars from data', () => {
        expect(component.bars()).toHaveLength(2);
    });

    it('should not be drilled down initially', () => {
        expect(component.isDrilledDown()).toBe(false);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    describe('onBarClick with drillable bar', () => {
        it('should drill down when clicking a bar with a drilldown property', () => {
            const drillableBar = component.bars()[0];
            const drilldownEvents: unknown[] = [];
            component.drilldown.subscribe(event => drilldownEvents.push(event));

            component.onBarClick(new MouseEvent('click'), drillableBar);

            expect(component.isDrilledDown()).toBe(true);
            expect(component.currentDrilldownId()).toBe('a-detail');
            expect(drilldownEvents).toHaveLength(1);
            expect(drilldownEvents[0]).toEqual({
                seriesId: 'a-detail',
                parentPoint: sampleData[0],
            });
        });

        it('should switch currentData to the drilldown series data', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);

            expect(component.currentData()).toEqual(sampleDrilldownSeries[0].data);
            expect(component.currentData()).toHaveLength(3);
        });

        it('should update currentSeriesName to the drilldown series name', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);

            expect(component.currentSeriesName()).toBe('Category A Details');
        });

        it('should recompute bars for the drilled-down data', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);

            expect(component.bars()).toHaveLength(3);
            expect(component.bars()[0].data.name).toBe('Sub A1');
        });

        it('should reset hoveredIndex when drilling down', () => {
            const drillableBar = component.bars()[0];
            component.hoveredIndex.set(0);
            component.onBarClick(new MouseEvent('click'), drillableBar);

            expect(component.hoveredIndex()).toBeNull();
        });
    });

    describe('onBarClick with non-drillable bar', () => {
        it('should not drill down when clicking a bar without drilldown property', () => {
            const nonDrillableBar = component.bars()[1];
            component.onBarClick(new MouseEvent('click'), nonDrillableBar);

            expect(component.isDrilledDown()).toBe(false);
            expect(component.currentDrilldownId()).toBeNull();
        });

        it('should still emit barClick for non-drillable bars', () => {
            const nonDrillableBar = component.bars()[1];
            const clickEvents: unknown[] = [];
            component.barClick.subscribe(event => clickEvents.push(event));

            component.onBarClick(new MouseEvent('click'), nonDrillableBar);

            expect(clickEvents).toHaveLength(1);
            expect(clickEvents[0]).toEqual(
                expect.objectContaining({ point: sampleData[1], index: 1 }),
            );
        });
    });

    describe('barClick output', () => {
        it('should always emit barClick regardless of drilldown capability', () => {
            const clickEvents: unknown[] = [];
            component.barClick.subscribe(event => clickEvents.push(event));

            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);

            const nonDrillableBar = component.bars()[1];
            component.onBarClick(new MouseEvent('click'), nonDrillableBar);

            expect(clickEvents).toHaveLength(2);
        });

        it('should include the MouseEvent in the emitted click event', () => {
            const clickEvents: { event?: MouseEvent }[] = [];
            component.barClick.subscribe(event => clickEvents.push(event));

            const mouseEvent = new MouseEvent('click');
            component.onBarClick(mouseEvent, component.bars()[0]);

            expect(clickEvents[0].event).toBe(mouseEvent);
        });
    });

    describe('onDrillUp', () => {
        it('should reset isDrilledDown to false', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            expect(component.isDrilledDown()).toBe(true);

            component.onDrillUp();

            expect(component.isDrilledDown()).toBe(false);
            expect(component.currentDrilldownId()).toBeNull();
        });

        it('should emit the drillup event', () => {
            const drillupEvents: void[] = [];
            component.drillup.subscribe(() => drillupEvents.push(undefined));

            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            component.onDrillUp();

            expect(drillupEvents).toHaveLength(1);
        });

        it('should restore currentData to the original top-level data', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            expect(component.currentData()).toEqual(sampleDrilldownSeries[0].data);

            component.onDrillUp();

            expect(component.currentData()).toEqual(sampleData);
        });

        it('should reset hoveredIndex on drill up', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            component.hoveredIndex.set(1);

            component.onDrillUp();

            expect(component.hoveredIndex()).toBeNull();
        });
    });

    describe('onBarClick when already drilled down', () => {
        it('should not drill down further if already in drilled-down state', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            expect(component.isDrilledDown()).toBe(true);

            const drilldownEvents: unknown[] = [];
            component.drilldown.subscribe(event => drilldownEvents.push(event));

            const drilledBars = component.bars();
            component.onBarClick(new MouseEvent('click'), drilledBars[0]);

            expect(drilldownEvents).toHaveLength(0);
            expect(component.currentDrilldownId()).toBe('a-detail');
        });
    });

    describe('hover behavior', () => {
        it('should set hoveredIndex when onBarHover is called', () => {
            const bar = component.bars()[0];
            component.onBarHover(bar);

            expect(component.hoveredIndex()).toBe(0);
        });

        it('should emit barHover with the bar data on hover', () => {
            const hoverEvents: unknown[] = [];
            component.barHover.subscribe(event => hoverEvents.push(event));

            const bar = component.bars()[1];
            component.onBarHover(bar);

            expect(hoverEvents).toHaveLength(1);
            expect(hoverEvents[0]).toEqual(
                expect.objectContaining({ point: sampleData[1], index: 1 }),
            );
        });

        it('should reset hoveredIndex to null on onBarLeave', () => {
            const bar = component.bars()[0];
            component.onBarHover(bar);
            expect(component.hoveredIndex()).toBe(0);

            component.onBarLeave();

            expect(component.hoveredIndex()).toBeNull();
        });

        it('should emit barHover with null on leave', () => {
            const hoverEvents: unknown[] = [];
            component.barHover.subscribe(event => hoverEvents.push(event));

            component.onBarLeave();

            expect(hoverEvents).toHaveLength(1);
            expect(hoverEvents[0]).toBeNull();
        });

        it('should update hoveredBar computed when hoveredIndex changes', () => {
            expect(component.hoveredBar()).toBeNull();

            const bar = component.bars()[0];
            component.onBarHover(bar);

            expect(component.hoveredBar()).toBeTruthy();
            expect(component.hoveredBar()!.index).toBe(0);
        });
    });

    describe('hasDrilldown', () => {
        it('should return true for a bar that has a matching drilldown series', () => {
            const drillableBar = component.bars()[0];
            expect(component.hasDrilldown(drillableBar)).toBe(true);
        });

        it('should return false for a bar without a drilldown property', () => {
            const nonDrillableBar = component.bars()[1];
            expect(component.hasDrilldown(nonDrillableBar)).toBe(false);
        });

        it('should return false for a bar with a drilldown id that has no matching series', () => {
            fixture.componentRef.setInput('data', [
                { name: 'Orphan', value: 10, drilldown: 'nonexistent-id' },
            ]);
            fixture.detectChanges();

            const orphanBar = component.bars()[0];
            expect(component.hasDrilldown(orphanBar)).toBe(false);
        });
    });

    describe('breadcrumb visibility', () => {
        it('should not show breadcrumb when not drilled down', () => {
            fixture.detectChanges();
            const backButton = fixture.nativeElement.querySelector(
                'button[type="button"]',
            );
            expect(backButton).toBeNull();
        });

        it('should show breadcrumb when drilled down and showBreadcrumb is true', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            fixture.detectChanges();

            const buttons = fixture.nativeElement.querySelectorAll(
                'button[type="button"]',
            );
            const backButton = Array.from(buttons).find(
                (btn: unknown) => (btn as HTMLElement).textContent?.includes('Back'),
            ) as HTMLElement | undefined;
            expect(backButton).toBeTruthy();
        });

        it('should display the drilldown series name in the breadcrumb', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            fixture.detectChanges();

            const breadcrumbText = fixture.nativeElement.textContent;
            expect(breadcrumbText).toContain('Category A Details');
        });

        it('should not show breadcrumb when showBreadcrumb is false even if drilled down', () => {
            fixture.componentRef.setInput('showBreadcrumb', false);
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            fixture.detectChanges();

            const buttons = fixture.nativeElement.querySelectorAll(
                'button[type="button"]',
            );
            const backButton = Array.from(buttons).find(
                (btn: unknown) => (btn as HTMLElement).textContent?.includes('Back'),
            ) as HTMLElement | undefined;
            expect(backButton).toBeFalsy();
        });

        it('should drill up when the breadcrumb back button is clicked', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            fixture.detectChanges();

            const buttons = fixture.nativeElement.querySelectorAll(
                'button[type="button"]',
            );
            const backButton = Array.from(buttons).find(
                (btn: unknown) => (btn as HTMLElement).textContent?.includes('Back'),
            ) as HTMLElement | undefined;
            expect(backButton).toBeTruthy();

            backButton!.click();
            fixture.detectChanges();

            expect(component.isDrilledDown()).toBe(false);
        });
    });

    describe('bars computed', () => {
        it('should generate bar rects with correct data references', () => {
            const bars = component.bars();
            expect(bars[0].data.name).toBe('Category A');
            expect(bars[0].value).toBe(50);
            expect(bars[1].data.name).toBe('Category B');
            expect(bars[1].value).toBe(30);
        });

        it('should assign sequential indices to bars', () => {
            const bars = component.bars();
            expect(bars[0].index).toBe(0);
            expect(bars[1].index).toBe(1);
        });

        it('should return empty array when data is empty', () => {
            fixture.componentRef.setInput('data', []);
            fixture.detectChanges();

            expect(component.bars()).toHaveLength(0);
        });

        it('should assign positive width and height to bars with positive values', () => {
            const bars = component.bars();
            for (const bar of bars) {
                expect(bar.width).toBeGreaterThan(0);
                expect(bar.height).toBeGreaterThan(0);
            }
        });
    });

    describe('currentSeriesName', () => {
        it('should return title or Overview when not drilled down', () => {
            expect(component.currentSeriesName()).toBe('Overview');
        });

        it('should return the provided title when not drilled down', () => {
            fixture.componentRef.setInput('title', 'My Chart');
            fixture.detectChanges();

            expect(component.currentSeriesName()).toBe('My Chart');
        });
    });
});
