import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PieChartDrilldownComponent } from './pie-chart-drilldown.component';
import { DrilldownDataPoint, DrilldownSeries } from '../../lib/chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('PieChartDrilldownComponent', () => {
    let component: PieChartDrilldownComponent;
    let fixture: ComponentFixture<PieChartDrilldownComponent>;

    const sampleData: DrilldownDataPoint[] = [
        { name: 'Fruits', value: 60, drilldown: 'fruits-detail' },
        { name: 'Vegetables', value: 40 },
    ];

    const sampleDrilldownSeries: DrilldownSeries[] = [
        {
            id: 'fruits-detail',
            name: 'Fruits Breakdown',
            data: [
                { name: 'Apples', value: 25 },
                { name: 'Bananas', value: 20 },
                { name: 'Oranges', value: 15 },
            ],
        },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PieChartDrilldownComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(PieChartDrilldownComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', sampleDrilldownSeries);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should compute slices from data', () => {
        expect(component.currentSlices().length).toBe(2);
    });

    it('should not be drilled down initially', () => {
        expect(component.isDrilledDown()).toBe(false);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should set aria-label on SVG', () => {
        const svg = fixture.nativeElement.querySelector('svg[role="img"]');
        expect(svg).toBeTruthy();
        expect(svg.getAttribute('aria-label')).toContain('Pie chart with drilldown');
    });

    describe('currentSlices computed', () => {
        it('should compute correct percentages for slices', () => {
            const slices = component.currentSlices();
            expect(slices[0].percentage).toBe(60);
            expect(slices[1].percentage).toBe(40);
        });

        it('should assign sequential indices', () => {
            const slices = component.currentSlices();
            expect(slices[0].index).toBe(0);
            expect(slices[1].index).toBe(1);
        });

        it('should assign a path string to each slice', () => {
            const slices = component.currentSlices();
            for (const slice of slices) {
                expect(slice.path).toBeTruthy();
                expect(typeof slice.path).toBe('string');
            }
        });

        it('should return empty array when data is empty', () => {
            fixture.componentRef.setInput('data', []);
            fixture.detectChanges();

            expect(component.currentSlices().length).toBe(0);
        });
    });

    describe('currentTotal computed', () => {
        it('should return the sum of all data values', () => {
            expect(component.currentTotal()).toBe(100);
        });

        it('should update when drilled down', () => {
            const slice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), slice);

            expect(component.currentTotal()).toBe(60);
        });
    });

    describe('onSliceClick with drillable slice', () => {
        it('should drill down when clicking a slice with a drilldown property', () => {
            const drillableSlice = component.currentSlices()[0];
            const drilldownEvents: unknown[] = [];
            component.drilldown.subscribe(event => drilldownEvents.push(event));

            component.onSliceClick(new MouseEvent('click'), drillableSlice);

            expect(component.isDrilledDown()).toBe(true);
            expect(component.currentDrilldownId()).toBe('fruits-detail');
            expect(drilldownEvents.length).toBe(1);
            expect(drilldownEvents[0]).toEqual({
                seriesId: 'fruits-detail',
                parentPoint: sampleData[0],
            });
        });

        it('should switch currentData to the drilldown series data', () => {
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);

            expect(component.currentData()).toEqual(sampleDrilldownSeries[0].data);
            expect(component.currentData().length).toBe(3);
        });

        it('should update currentSeriesName to the drilldown series name', () => {
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);

            expect(component.currentSeriesName()).toBe('Fruits Breakdown');
        });

        it('should recompute slices for the drilled-down data', () => {
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);

            const newSlices = component.currentSlices();
            expect(newSlices.length).toBe(3);
            expect(newSlices[0].data.name).toBe('Apples');
        });

        it('should reset hoveredIndex when drilling down', () => {
            component.hoveredIndex.set(0);
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);

            expect(component.hoveredIndex()).toBeNull();
        });
    });

    describe('onSliceClick with non-drillable slice', () => {
        it('should not drill down when clicking a slice without drilldown property', () => {
            const nonDrillableSlice = component.currentSlices()[1];
            component.onSliceClick(new MouseEvent('click'), nonDrillableSlice);

            expect(component.isDrilledDown()).toBe(false);
            expect(component.currentDrilldownId()).toBeNull();
        });

        it('should still emit sliceClick for non-drillable slices', () => {
            const clickEvents: unknown[] = [];
            component.sliceClick.subscribe(event => clickEvents.push(event));

            const nonDrillableSlice = component.currentSlices()[1];
            component.onSliceClick(new MouseEvent('click'), nonDrillableSlice);

            expect(clickEvents.length).toBe(1);
            expect(clickEvents[0]).toEqual(
                expect.objectContaining({ point: sampleData[1], index: 1 }),
            );
        });
    });

    describe('sliceClick output', () => {
        it('should always emit sliceClick regardless of drilldown capability', () => {
            const clickEvents: unknown[] = [];
            component.sliceClick.subscribe(event => clickEvents.push(event));

            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);

            const nonDrillableSlice = component.currentSlices()[1];
            component.onSliceClick(new MouseEvent('click'), nonDrillableSlice);

            expect(clickEvents.length).toBe(2);
        });

        it('should include the MouseEvent in the emitted click event', () => {
            const clickEvents: { event?: MouseEvent }[] = [];
            component.sliceClick.subscribe(event => clickEvents.push(event));

            const mouseEvent = new MouseEvent('click');
            component.onSliceClick(mouseEvent, component.currentSlices()[0]);

            expect(clickEvents[0].event).toBe(mouseEvent);
        });
    });

    describe('onDrillUp', () => {
        it('should reset isDrilledDown to false', () => {
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);
            expect(component.isDrilledDown()).toBe(true);

            component.onDrillUp();

            expect(component.isDrilledDown()).toBe(false);
            expect(component.currentDrilldownId()).toBeNull();
        });

        it('should emit the drillup event', () => {
            const drillupEvents: void[] = [];
            component.drillup.subscribe(() => drillupEvents.push(undefined));

            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);
            component.onDrillUp();

            expect(drillupEvents.length).toBe(1);
        });

        it('should restore currentData to the original top-level data', () => {
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);
            expect(component.currentData()).toEqual(sampleDrilldownSeries[0].data);

            component.onDrillUp();

            expect(component.currentData()).toEqual(sampleData);
        });

        it('should restore currentTotal to original sum', () => {
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);
            expect(component.currentTotal()).toBe(60);

            component.onDrillUp();

            expect(component.currentTotal()).toBe(100);
        });

        it('should reset hoveredIndex on drill up', () => {
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);
            component.hoveredIndex.set(2);

            component.onDrillUp();

            expect(component.hoveredIndex()).toBeNull();
        });
    });

    describe('onSliceClick when already drilled down', () => {
        it('should not drill down further if already in drilled-down state', () => {
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);
            expect(component.isDrilledDown()).toBe(true);

            const drilldownEvents: unknown[] = [];
            component.drilldown.subscribe(event => drilldownEvents.push(event));

            const drilledSlices = component.currentSlices();
            component.onSliceClick(new MouseEvent('click'), drilledSlices[0]);

            expect(drilldownEvents.length).toBe(0);
            expect(component.currentDrilldownId()).toBe('fruits-detail');
        });
    });

    describe('hover behavior', () => {
        it('should set hoveredIndex when onSliceHover is called', () => {
            const slice = component.currentSlices()[0];
            component.onSliceHover(slice);

            expect(component.hoveredIndex()).toBe(0);
        });

        it('should emit sliceHover with the slice data on hover', () => {
            const hoverEvents: unknown[] = [];
            component.sliceHover.subscribe(event => hoverEvents.push(event));

            const slice = component.currentSlices()[1];
            component.onSliceHover(slice);

            expect(hoverEvents.length).toBe(1);
            expect(hoverEvents[0]).toEqual(
                expect.objectContaining({ point: sampleData[1], index: 1 }),
            );
        });

        it('should reset hoveredIndex to null on onSliceLeave', () => {
            const slice = component.currentSlices()[0];
            component.onSliceHover(slice);
            expect(component.hoveredIndex()).toBe(0);

            component.onSliceLeave();

            expect(component.hoveredIndex()).toBeNull();
        });

        it('should emit sliceHover with null on leave', () => {
            const hoverEvents: unknown[] = [];
            component.sliceHover.subscribe(event => hoverEvents.push(event));

            component.onSliceLeave();

            expect(hoverEvents.length).toBe(1);
            expect(hoverEvents[0]).toBeNull();
        });

        it('should update hoveredSlice computed when hoveredIndex changes', () => {
            expect(component.hoveredSlice()).toBeNull();

            const slice = component.currentSlices()[0];
            component.onSliceHover(slice);

            expect(component.hoveredSlice()).toBeTruthy();
            expect(component.hoveredSlice()!.index).toBe(0);
        });
    });

    describe('hasDrilldown', () => {
        it('should return true for a slice that has a matching drilldown series', () => {
            const drillableSlice = component.currentSlices()[0];
            expect(component.hasDrilldown(drillableSlice)).toBe(true);
        });

        it('should return false for a slice without a drilldown property', () => {
            const nonDrillableSlice = component.currentSlices()[1];
            expect(component.hasDrilldown(nonDrillableSlice)).toBe(false);
        });

        it('should return false for a slice with a drilldown id that has no matching series', () => {
            fixture.componentRef.setInput('data', [
                { name: 'Orphan', value: 10, drilldown: 'nonexistent-id' },
            ]);
            fixture.detectChanges();

            const orphanSlice = component.currentSlices()[0];
            expect(component.hasDrilldown(orphanSlice)).toBe(false);
        });
    });

    describe('breadcrumb visibility', () => {
        it('should not show breadcrumb when not drilled down', () => {
            fixture.detectChanges();
            const buttons = fixture.nativeElement.querySelectorAll(
                'button[type="button"]',
            );
            const backButton = Array.from(buttons).find(
                (btn: unknown) => (btn as HTMLElement).textContent?.includes('Back'),
            ) as HTMLElement | undefined;
            expect(backButton).toBeFalsy();
        });

        it('should show breadcrumb when drilled down and showBreadcrumb is true', () => {
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);
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
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);
            fixture.detectChanges();

            const breadcrumbText = fixture.nativeElement.textContent;
            expect(breadcrumbText).toContain('Fruits Breakdown');
        });

        it('should not show breadcrumb when showBreadcrumb is false even if drilled down', () => {
            fixture.componentRef.setInput('showBreadcrumb', false);
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);
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
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);
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

    describe('legend rendering', () => {
        it('should render legend items when showLegend is true', () => {
            fixture.componentRef.setInput('showLegend', true);
            fixture.componentRef.setInput('legendPosition', 'right');
            fixture.detectChanges();

            const legendText = fixture.nativeElement.textContent;
            expect(legendText).toContain('Fruits');
            expect(legendText).toContain('Vegetables');
        });

        it('should not render legend when showLegend is false', () => {
            fixture.componentRef.setInput('showLegend', false);
            fixture.detectChanges();

            const legendButtons = fixture.nativeElement.querySelectorAll(
                '.flex.items-center.gap-2.text-sm',
            );
            expect(legendButtons.length).toBe(0);
        });

        it('should not render legend when legendPosition is none', () => {
            fixture.componentRef.setInput('legendPosition', 'none');
            fixture.detectChanges();

            const container = fixture.nativeElement;
            const legendColorDots = container.querySelectorAll('.w-3.h-3.rounded-sm');
            expect(legendColorDots.length).toBe(0);
        });
    });

    describe('currentSeriesName', () => {
        it('should return Overview by default when not drilled down', () => {
            expect(component.currentSeriesName()).toBe('Overview');
        });

        it('should return the provided title when not drilled down', () => {
            fixture.componentRef.setInput('title', 'Distribution');
            fixture.detectChanges();

            expect(component.currentSeriesName()).toBe('Distribution');
        });

        it('should return the drilldown series name when drilled down', () => {
            const drillableSlice = component.currentSlices()[0];
            component.onSliceClick(new MouseEvent('click'), drillableSlice);

            expect(component.currentSeriesName()).toBe('Fruits Breakdown');
        });
    });
});
