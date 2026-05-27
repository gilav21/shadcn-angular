import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ChartsDemoComponent } from './charts-demo.component';
import { CHARTS_DEMO_LOCALES } from './charts-demo.locales';

describe('ChartsDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ChartsDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CHARTS_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(ChartsDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CHARTS_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(CHARTS_DEMO_LOCALES['en'].title);
  });
});
