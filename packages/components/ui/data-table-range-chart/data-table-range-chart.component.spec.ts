import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, it, expect } from 'vitest';
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

describe('DataTableRangeChartComponent', () => {
  let component: DataTableRangeChartComponent;
  let fixture: ComponentFixture<DataTableRangeChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableRangeChartComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DataTableRangeChartComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('payload', MULTI_SERIES);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
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

  it('switches chart type', () => {
    expect(component.chartType()).toBe('bar');
    component.selectChartType('pie');
    expect(component.chartType()).toBe('pie');
  });

  it('hides the stacked switch when there is a single series', () => {
    fixture.componentRef.setInput('payload', SINGLE_SERIES);
    fixture.detectChanges();
    const labels = fixture.debugElement
      .queryAll(By.css('[data-slot="range-chart-switcher"] ui-button'))
      .map((b) => (b.nativeElement as HTMLElement).textContent?.trim());
    expect(labels).toEqual(['bar', 'pie']);
  });

  it('renders the bar chart by default and swaps to pie on selection', () => {
    expect(fixture.debugElement.query(By.css('ui-bar-chart'))).toBeTruthy();
    component.selectChartType('pie');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('ui-pie-chart'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('ui-bar-chart'))).toBeNull();
  });
});
