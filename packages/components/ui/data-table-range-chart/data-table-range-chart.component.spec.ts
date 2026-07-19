import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from 'vitest';
import { By } from '@angular/platform-browser';
import {
  DataTableRangeChartComponent,
  RangeChartData,
} from './data-table-range-chart.component';

const SINGLE_SERIES: RangeChartData = {
  categories: ['Alice', 'Bob'],
  series: [{ name: 'Sales', values: [10, 30] }],
};

const MULTI_SERIES: RangeChartData = {
  categories: ['Alice', 'Bob'],
  series: [
    { name: 'Q1', values: [10, 30] },
    { name: 'Q2', values: [20, 40] },
  ],
};

class ResizeObserverStub {
  observe(): void {
    /* no-op: jsdom has no layout, so no resize callbacks fire */
  }
  disconnect(): void {
    /* no-op */
  }
}

type SvgWithBBox = { getBBox?: () => DOMRect };

const svgProto = SVGElement.prototype as unknown as SvgWithBBox;
const globalWithRo = globalThis as unknown as { ResizeObserver?: unknown };
const originalResizeObserver = globalWithRo.ResizeObserver;
const originalGetBBox = svgProto.getBBox;
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

const FIXED_RECT = {
  x: 0,
  y: 0,
  width: 500,
  height: 300,
  top: 0,
  left: 0,
  right: 500,
  bottom: 300,
  toJSON: () => ({}),
} as DOMRect;

describe('DataTableRangeChartComponent', () => {
  let component: DataTableRangeChartComponent;
  let fixture: ComponentFixture<DataTableRangeChartComponent>;

  beforeEach(async () => {
    globalWithRo.ResizeObserver = ResizeObserverStub;
    svgProto.getBBox = () => FIXED_RECT;
    Element.prototype.getBoundingClientRect = () => FIXED_RECT;

    await TestBed.configureTestingModule({
      imports: [DataTableRangeChartComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DataTableRangeChartComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('payload', MULTI_SERIES);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    globalWithRo.ResizeObserver = originalResizeObserver;
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    if (originalGetBBox) {
      svgProto.getBBox = originalGetBBox;
    } else {
      delete svgProto.getBBox;
    }
  });

  it('maps the first series onto categories for bar/pie data', () => {
    expect(component.barData()).toEqual([
      { name: 'Alice', value: 10 },
      { name: 'Bob', value: 30 },
    ]);
  });

  it('maps every series for stacked data', () => {
    expect(component.stackedSeries()).toEqual([
      { name: 'Q1', data: [{ name: 'Alice', value: 10 }, { name: 'Bob', value: 30 }] },
      { name: 'Q2', data: [{ name: 'Alice', value: 20 }, { name: 'Bob', value: 40 }] },
    ]);
  });

  it('reports multiple series', () => {
    expect(component.hasMultipleSeries()).toBe(true);
    fixture.componentRef.setInput('payload', SINGLE_SERIES);
    expect(component.hasMultipleSeries()).toBe(false);
  });

  it('returns empty data for a null payload', () => {
    fixture.componentRef.setInput('payload', null);
    expect(component.barData()).toEqual([]);
    expect(component.stackedSeries()).toEqual([]);
    expect(component.categories()).toEqual([]);
  });

  it('maps categories from a populated payload', () => {
    expect(component.categories()).toEqual(['Alice', 'Bob']);
  });

  it('substitutes 0 for missing series values', () => {
    fixture.componentRef.setInput('payload', {
      categories: ['Alice', 'Bob', 'Cara'],
      series: [{ name: 'Sales', values: [10] }],
    } satisfies RangeChartData);
    expect(component.barData()).toEqual([
      { name: 'Alice', value: 10 },
      { name: 'Bob', value: 0 },
      { name: 'Cara', value: 0 },
    ]);
    expect(component.stackedSeries()).toEqual([
      {
        name: 'Sales',
        data: [
          { name: 'Alice', value: 10 },
          { name: 'Bob', value: 0 },
          { name: 'Cara', value: 0 },
        ],
      },
    ]);
  });

  it('switches chart type', () => {
    expect(component.chartType()).toBe('bar');
    component.selectChartType('pie');
    expect(component.chartType()).toBe('pie');
  });

  it('exposes the available chart types', () => {
    expect(component.chartTypes).toEqual(['bar', 'pie', 'stacked']);
  });

  it('composes the custom class into the container classes', () => {
    fixture.componentRef.setInput('class', 'my-custom-class');
    fixture.detectChanges();
    const container = fixture.debugElement.query(
      By.css('[data-slot="range-chart"]')
    ).nativeElement as HTMLElement;
    expect(container.className).toContain('my-custom-class');
    expect(container.className).toContain('flex');
    expect(component.classes()).toContain('my-custom-class');
  });

  it('renders the dialog title from the title input', () => {
    fixture.componentRef.setInput('title', 'Range Report');
    fixture.detectChanges();
    const titleEl = fixture.debugElement.query(By.css('ui-dialog-title'))
      .nativeElement as HTMLElement;
    expect(titleEl.textContent?.trim()).toBe('Range Report');
  });

  it('hides the stacked switch when there is a single series', () => {
    fixture.componentRef.setInput('payload', SINGLE_SERIES);
    fixture.detectChanges();
    const labels = fixture.debugElement
      .queryAll(By.css('[data-slot="range-chart-switcher"] ui-button'))
      .map((b) => (b.nativeElement as HTMLElement).textContent?.trim());
    expect(labels).toEqual(['bar', 'pie']);
  });

  it('shows all three switches when there are multiple series', () => {
    const labels = fixture.debugElement
      .queryAll(By.css('[data-slot="range-chart-switcher"] ui-button'))
      .map((b) => (b.nativeElement as HTMLElement).textContent?.trim());
    expect(labels).toEqual(['bar', 'pie', 'stacked']);
  });

  it('renders the bar chart by default and swaps to pie on selection', () => {
    expect(fixture.debugElement.query(By.css('ui-bar-chart'))).toBeTruthy();
    component.selectChartType('pie');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('ui-pie-chart'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('ui-bar-chart'))).toBeNull();
  });

  it('renders the stacked chart when the stacked type is selected', () => {
    component.selectChartType('stacked');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('ui-stacked-bar-chart'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('ui-bar-chart'))).toBeNull();
  });
});
