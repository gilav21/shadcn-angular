import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartDrilldownComponent } from './bar-chart-drilldown.component';
import { DrilldownDataPoint } from './chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('BarChartDrilldownComponent', () => {
    let component: BarChartDrilldownComponent;
    let fixture: ComponentFixture<BarChartDrilldownComponent>;

    const sampleData: DrilldownDataPoint[] = [
        { name: 'Category A', value: 50, drilldown: 'a-detail' },
        { name: 'Category B', value: 30 },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BarChartDrilldownComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(BarChartDrilldownComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should compute bars from data', () => {
        expect(component.bars().length).toBe(2);
    });

    it('should not be drilled down initially', () => {
        expect(component.isDrilledDown()).toBe(false);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });
});
