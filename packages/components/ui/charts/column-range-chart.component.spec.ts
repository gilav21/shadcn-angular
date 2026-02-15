import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColumnRangeChartComponent } from './column-range-chart.component';
import { RangeDataPoint } from './chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ColumnRangeChartComponent', () => {
    let component: ColumnRangeChartComponent;
    let fixture: ComponentFixture<ColumnRangeChartComponent>;

    const sampleData: RangeDataPoint[] = [
        { name: 'Jan', low: -5, high: 10 },
        { name: 'Feb', low: -3, high: 12 },
        { name: 'Mar', low: 2, high: 18 },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ColumnRangeChartComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ColumnRangeChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should compute bars from data', () => {
        expect(component.bars().length).toBe(3);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should set aria-label on SVG', () => {
        const svg = fixture.nativeElement.querySelector('svg[role="img"]');
        expect(svg).toBeTruthy();
        expect(svg.getAttribute('aria-label')).toContain('Column range chart');
    });
});
