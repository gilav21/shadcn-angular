import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ChartTooltipComponent } from './chart-tooltip.component';

describe('ChartTooltipComponent', () => {
    let component: ChartTooltipComponent;
    let fixture: ComponentFixture<ChartTooltipComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ChartTooltipComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(ChartTooltipComponent);
        component = fixture.componentInstance;
    });

    function tooltipEl(): HTMLElement | null {
        return fixture.nativeElement.querySelector('[data-slot="chart-tooltip"]');
    }

    it('renders nothing when not visible', () => {
        fixture.componentRef.setInput('visible', false);
        fixture.detectChanges();
        expect(tooltipEl()).toBeNull();
    });

    it('renders a positioned tooltip when visible', () => {
        fixture.componentRef.setInput('visible', true);
        fixture.componentRef.setInput('x', 40);
        fixture.componentRef.setInput('y', 25);
        fixture.componentRef.setInput('title', 'Q1');
        fixture.detectChanges();
        const el = tooltipEl();
        expect(el).toBeTruthy();
        expect(el!.textContent).toContain('Q1');
        expect(el!.style.left).toBe('40px');
        expect(el!.style.top).toBe('25px');
    });

    it('renders one row per series entry with label and value', () => {
        fixture.componentRef.setInput('visible', true);
        fixture.componentRef.setInput('rows', [
            { label: 'Revenue', value: '1.2K', color: 'hsl(221, 83%, 53%)' },
            { label: 'Cost', value: '800' },
        ]);
        fixture.detectChanges();
        const el = tooltipEl()!;
        expect(el.textContent).toContain('Revenue');
        expect(el.textContent).toContain('1.2K');
        expect(el.textContent).toContain('Cost');
        expect(el.textContent).toContain('800');
    });

    it('protects against viewport overflow with a max-width', () => {
        fixture.componentRef.setInput('visible', true);
        fixture.detectChanges();
        expect(tooltipEl()!.className).toContain('max-w-[calc(100vw-2rem)]');
    });

    it('merges a custom class', () => {
        fixture.componentRef.setInput('visible', true);
        fixture.componentRef.setInput('class', 'my-custom');
        fixture.detectChanges();
        expect(tooltipEl()!.className).toContain('my-custom');
    });
});
