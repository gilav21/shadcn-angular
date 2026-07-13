import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { FunnelChartComponent } from './funnel-chart.component';
import { ChartDataPoint } from '../../lib/chart.types';

describe('FunnelChartComponent', () => {
    let component: FunnelChartComponent;
    let fixture: ComponentFixture<FunnelChartComponent>;

    const data: ChartDataPoint[] = [
        { name: 'Visits', value: 1000 },
        { name: 'Signups', value: 600 },
        { name: 'Trials', value: 300 },
        { name: 'Paid', value: 120 },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FunnelChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(FunnelChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
    });

    it('renders with an accessible Funnel chart label', () => {
        const c = fixture.nativeElement.querySelector('[role="group"]');
        expect(c.getAttribute('aria-label')).toContain('Funnel chart');
    });

    it('renders one trapezoid per stage', () => {
        expect(fixture.nativeElement.querySelectorAll('polygon[data-slot="funnel-stage"]')).toHaveLength(4);
    });

    it('computes percentages relative to the first stage by default', () => {
        const stages = component.stages();
        expect(stages[0].percent).toBeCloseTo(100, 5);
        expect(stages[1].percent).toBeCloseTo(60, 5);
        expect(stages[3].percent).toBeCloseTo(12, 5);
    });

    it('computes percentages relative to the previous stage when configured', () => {
        fixture.componentRef.setInput('percentageMode', 'previous');
        fixture.detectChanges();
        const stages = component.stages();
        expect(stages[0].percent).toBeCloseTo(100, 5);
        expect(stages[1].percent).toBeCloseTo(60, 5); // 600/1000
        expect(stages[2].percent).toBeCloseTo(50, 5); // 300/600
    });

    it('makes earlier (larger) stages wider than later stages', () => {
        const stages = component.stages();
        expect(stages[0].topWidth).toBeGreaterThan(stages[3].topWidth);
    });

    it('builds tooltip rows for the hovered stage', () => {
        component.setHover(1);
        const rows = component.tooltipRows();
        expect(rows[0].value).toContain('600');
        expect(component.hoverTitle()).toContain('Signups');
    });

    it('emits stageClick with the stage data', () => {
        let emitted: { index: number } | undefined;
        component.stageClick.subscribe(e => (emitted = e));
        component.onStageClick(2);
        expect(emitted?.index).toBe(2);
    });
});
