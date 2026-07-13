import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { WaterfallChartComponent } from './waterfall-chart.component';
import { WaterfallBar } from '../../lib/chart.types';

describe('WaterfallChartComponent', () => {
    let component: WaterfallChartComponent;
    let fixture: ComponentFixture<WaterfallChartComponent>;

    const data: WaterfallBar[] = [
        { name: 'Q1', value: 500 },
        { name: 'Q2', value: 300 },
        { name: 'Q3', value: -200 },
        { name: 'Total', value: 600, type: 'total' },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [WaterfallChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(WaterfallChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
    });

    it('renders with an accessible Waterfall chart label', () => {
        const c = fixture.nativeElement.querySelector('[role="group"]');
        expect(c.getAttribute('aria-label')).toContain('Waterfall chart');
    });

    it('renders one bar per data point', () => {
        expect(fixture.nativeElement.querySelectorAll('rect[data-slot="waterfall-bar"]')).toHaveLength(4);
    });

    it('accumulates running totals across relative bars', () => {
        const bars = component.bars();
        expect(bars[0].toLevel).toBe(500);
        expect(bars[1].fromLevel).toBe(500);
        expect(bars[1].toLevel).toBe(800);
        expect(bars[2].toLevel).toBe(600); // 800 - 200
    });

    it('treats a total bar as an absolute column from zero', () => {
        const bars = component.bars();
        const total = bars[3];
        expect(total.fromLevel).toBe(0);
        expect(total.toLevel).toBe(600);
    });

    it('colors increases, decreases, and totals differently', () => {
        const bars = component.bars();
        expect(bars[0].color).toBe(component.positiveColor());
        expect(bars[2].color).toBe(component.negativeColor());
        expect(bars[3].color).toBe(component.totalColor());
    });

    it('renders connectors between consecutive bars when enabled', () => {
        fixture.componentRef.setInput('showConnectors', true);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('line[data-slot="waterfall-connector"]')).toHaveLength(3);
    });

    it('builds a tooltip row for the hovered bar', () => {
        component.setHover(1);
        expect(component.tooltipRows()[0].value).toContain('300');
        expect(component.hoverTitle()).toContain('Q2');
    });
});
