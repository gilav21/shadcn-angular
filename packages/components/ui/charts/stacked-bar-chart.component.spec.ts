import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StackedBarChartComponent } from './stacked-bar-chart.component';
import { ChartSeries } from './chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('StackedBarChartComponent', () => {
    let component: StackedBarChartComponent;
    let fixture: ComponentFixture<StackedBarChartComponent>;

    const sampleSeries: ChartSeries[] = [
        { name: 'Series A', data: [{ name: 'Q1', value: 10 }, { name: 'Q2', value: 20 }] },
        { name: 'Series B', data: [{ name: 'Q1', value: 15 }, { name: 'Q2', value: 25 }] },
    ];
    const sampleCategories = ['Q1', 'Q2'];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [StackedBarChartComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(StackedBarChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', sampleCategories);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should compute stacked bars from series and categories', () => {
        expect(component.stackedBars().length).toBe(2);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should set aria-label on SVG', () => {
        const svg = fixture.nativeElement.querySelector('svg[role="img"]');
        expect(svg).toBeTruthy();
        expect(svg.getAttribute('aria-label')).toContain('Stacked column chart');
    });
});
