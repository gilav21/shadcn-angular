import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { BubbleChartComponent } from './bubble-chart.component';
import { XYZSeries } from '../../lib/chart.types';

describe('BubbleChartComponent', () => {
    let component: BubbleChartComponent;
    let fixture: ComponentFixture<BubbleChartComponent>;

    const series: XYZSeries[] = [
        { name: 'Markets', points: [
            { x: 1, y: 2, z: 5 },
            { x: 3, y: 5, z: 50 },
            { x: 5, y: 1, z: 20 },
        ] },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BubbleChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(BubbleChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', series);
        fixture.detectChanges();
    });

    it('renders with an accessible Bubble chart label', () => {
        const c = fixture.nativeElement.querySelector('[role="img"]');
        expect(c.getAttribute('aria-label')).toContain('Bubble chart');
    });

    it('renders one bubble per point', () => {
        expect(fixture.nativeElement.querySelectorAll('circle[data-slot="bubble-point"]').length).toBe(3);
    });

    it('maps larger z values to larger radii', () => {
        const bubbles = component.bubbles();
        const big = bubbles.find(b => b.datum.z === 50)!;
        const small = bubbles.find(b => b.datum.z === 5)!;
        expect(big.r).toBeGreaterThan(small.r);
    });

    it('keeps all radii within the configured range', () => {
        fixture.componentRef.setInput('minRadius', 4);
        fixture.componentRef.setInput('maxRadius', 20);
        fixture.detectChanges();
        for (const b of component.bubbles()) {
            expect(b.r).toBeGreaterThanOrEqual(4);
            expect(b.r).toBeLessThanOrEqual(20);
        }
    });

    it('includes the z magnitude in the tooltip', () => {
        component.setHover(0, 1); // z = 50
        const rows = component.tooltipRows();
        expect(rows.some(r => r.value.includes('50'))).toBe(true);
    });

    it('hides a series when toggled off via the legend', () => {
        component.toggleSeries('Markets');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('circle[data-slot="bubble-point"]').length).toBe(0);
    });
});
