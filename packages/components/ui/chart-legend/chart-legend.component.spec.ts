import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ChartLegendComponent } from './chart-legend.component';

describe('ChartLegendComponent', () => {
    let component: ChartLegendComponent;
    let fixture: ComponentFixture<ChartLegendComponent>;

    const items = [
        { key: 'rev', label: 'Revenue', color: 'hsl(221, 83%, 53%)' },
        { key: 'cost', label: 'Cost', color: 'hsl(0, 84%, 60%)' },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ChartLegendComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(ChartLegendComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('items', items);
        fixture.detectChanges();
    });

    function legendItems(): HTMLElement[] {
        return Array.from(fixture.nativeElement.querySelectorAll('[data-slot="chart-legend-item"]'));
    }

    it('renders one entry per item with its label', () => {
        const els = legendItems();
        expect(els).toHaveLength(2);
        expect(els[0].textContent).toContain('Revenue');
        expect(els[1].textContent).toContain('Cost');
    });

    it('emits toggle with the series key when an interactive item is clicked', () => {
        let emitted: string | undefined;
        component.toggle.subscribe(k => (emitted = k));
        legendItems()[1].click();
        expect(emitted).toBe('cost');
    });

    it('emits toggle on Enter keydown', () => {
        let emitted: string | undefined;
        component.toggle.subscribe(k => (emitted = k));
        legendItems()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(emitted).toBe('rev');
    });

    it('reflects hidden state via aria-pressed', () => {
        fixture.componentRef.setInput('hidden', ['cost']);
        fixture.detectChanges();
        const els = legendItems();
        expect(els[0].getAttribute('aria-pressed')).toBe('true');
        expect(els[1].getAttribute('aria-pressed')).toBe('false');
    });

    it('does not emit toggle or use button role when non-interactive', () => {
        fixture.componentRef.setInput('interactive', false);
        fixture.detectChanges();
        let emitted: string | undefined;
        component.toggle.subscribe(k => (emitted = k));
        const el = legendItems()[0];
        el.click();
        expect(emitted).toBeUndefined();
        expect(el.getAttribute('role')).not.toBe('button');
    });

    it('exposes a data-slot on the container', () => {
        expect(fixture.nativeElement.querySelector('[data-slot="chart-legend"]')).toBeTruthy();
    });
});
