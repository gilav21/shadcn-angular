import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
} from 'vitest';
import { BulletChartComponent } from './bullet-chart.component';

interface Restorable {
    restore: () => void;
}

function stubBrowserApis(): Restorable {
    const origBBox = (SVGElement.prototype as unknown as { getBBox?: unknown }).getBBox;
    const origRect = Element.prototype.getBoundingClientRect;
    const origResizeObserver = (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    const origMatchMedia = (globalThis as unknown as { matchMedia?: unknown }).matchMedia;

    (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
        ({ x: 0, y: 0, width: 100, height: 20 }) as unknown as DOMRect;

    Element.prototype.getBoundingClientRect = () =>
        ({ x: 0, y: 0, width: 360, height: 40, top: 0, left: 0, right: 360, bottom: 40, toJSON: () => ({}) }) as DOMRect;

    class MockResizeObserver {
        observe(): void {
            /* no-op */
        }
        unobserve(): void {
            /* no-op */
        }
        disconnect(): void {
            /* no-op */
        }
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;

    (globalThis as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    });

    return {
        restore: () => {
            if (origBBox === undefined) {
                delete (SVGElement.prototype as unknown as { getBBox?: unknown }).getBBox;
            } else {
                (SVGElement.prototype as unknown as { getBBox: unknown }).getBBox = origBBox;
            }
            Element.prototype.getBoundingClientRect = origRect;
            (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = origResizeObserver;
            (globalThis as unknown as { matchMedia?: unknown }).matchMedia = origMatchMedia;
        },
    };
}

describe('BulletChartComponent', () => {
    let component: BulletChartComponent;
    let fixture: ComponentFixture<BulletChartComponent>;
    let stubs: Restorable;

    beforeEach(async () => {
        stubs = stubBrowserApis();
        await TestBed.configureTestingModule({
            imports: [BulletChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(BulletChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('value', 70);
        fixture.componentRef.setInput('target', 80);
        fixture.componentRef.setInput('ranges', [50, 75, 100]);
        fixture.detectChanges();
    });

    afterEach(() => {
        stubs.restore();
    });

    it('renders with an accessible Bullet label including value and target', () => {
        const c = fixture.nativeElement.querySelector('[role="img"]');
        const label = c.getAttribute('aria-label');
        expect(label).toContain('70');
        expect(label).toContain('80');
        expect(label).toContain('Bullet chart.');
    });

    it('derives the max from ranges, value, and target', () => {
        expect(component.maxValue()).toBe(100);
    });

    it('renders one qualitative band per range with increasing opacity', () => {
        const bands = fixture.nativeElement.querySelectorAll('rect[data-slot="bullet-range"]');
        expect(bands).toHaveLength(3);
        const model = component.rangeBands();
        expect(model).toHaveLength(3);
        expect(model[0].opacity).toBeLessThan(model[2].opacity);
        expect(model[0].width).toBeGreaterThan(0);
    });

    it('renders a measure bar whose width reflects the value', () => {
        const measure = fixture.nativeElement.querySelector('rect[data-slot="bullet-measure"]');
        expect(measure).toBeTruthy();
        expect(component.measureWidth()).toBeGreaterThan(0);
        expect(component.measureHeight()).toBeCloseTo(component.height() / 3, 5);
        expect(component.barY()).toBeCloseTo(component.height() / 2 - component.measureHeight() / 2, 5);
    });

    it('positions the target marker proportionally to the target value', () => {
        const expected = (80 / 100) * component.trackWidth();
        expect(component.targetX()).toBeCloseTo(expected, 0);
    });

    it('renders a target marker element', () => {
        expect(fixture.nativeElement.querySelector('[data-slot="bullet-target"]')).toBeTruthy();
    });

    it('caps the measure width at the track width when value exceeds max', () => {
        fixture.componentRef.setInput('value', 500);
        fixture.detectChanges();
        expect(component.measureWidth()).toBeLessThanOrEqual(component.trackWidth() + 0.001);
    });

    it('falls back to the width input for viewBox / svgWidth when unmeasured', () => {
        fixture.componentRef.setInput('width', 500);
        fixture.detectChanges();
        expect(component.svgWidth()).toBe(500);
        expect(component.viewBox()).toBe('0 0 500 40');
        expect(component.trackWidth()).toBe(500 - 8);
    });

    it('applies default measure color and honors an explicit color input', () => {
        expect(component.measureColor()).toBe('hsl(var(--primary))');
        fixture.componentRef.setInput('color', '#ff0000');
        fixture.detectChanges();
        expect(component.measureColor()).toBe('#ff0000');
    });

    it('merges custom class input into computed classes', () => {
        fixture.componentRef.setInput('class', 'my-custom-class');
        fixture.detectChanges();
        expect(component.classes()).toContain('my-custom-class');
        expect(component.classes()).toContain('block');
    });

    it('omits the target marker and target text when no target is provided', () => {
        fixture.componentRef.setInput('target', undefined);
        fixture.detectChanges();
        expect(component.targetX()).toBeNull();
        expect(fixture.nativeElement.querySelector('[data-slot="bullet-target"]')).toBeNull();
        expect(component.ariaLabel()).not.toContain('target');
    });

    it('includes title, label and unit in the accessible label and display value', () => {
        fixture.componentRef.setInput('title', 'Revenue');
        fixture.componentRef.setInput('label', 'Q1');
        fixture.componentRef.setInput('unit', '%');
        fixture.detectChanges();
        expect(component.displayValue()).toBe('70%');
        const label = component.ariaLabel();
        expect(label).toContain('Revenue.');
        expect(label).toContain('Q1:');
        expect(label).toContain('70%');
        expect(label).toContain('target 80%');
    });

    it('handles empty ranges with a positive fallback max', () => {
        fixture.componentRef.setInput('ranges', []);
        fixture.componentRef.setInput('target', undefined);
        fixture.componentRef.setInput('value', 0);
        fixture.componentRef.setInput('min', 0);
        fixture.detectChanges();
        expect(component.rangeBands()).toHaveLength(0);
        expect(component.maxValue()).toBe(1);
        expect(component.measureWidth()).toBeGreaterThanOrEqual(0);
    });

    it('respects a non-zero min when scaling range bands', () => {
        fixture.componentRef.setInput('min', 40);
        fixture.componentRef.setInput('ranges', [60, 80]);
        fixture.componentRef.setInput('value', 70);
        fixture.componentRef.setInput('target', 80);
        fixture.detectChanges();
        const bands = component.rangeBands();
        expect(bands).toHaveLength(2);
        expect(bands[0].x).toBeCloseTo(0, 5);
    });
});
