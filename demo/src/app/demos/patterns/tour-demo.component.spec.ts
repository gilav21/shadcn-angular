import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { TourDemoComponent } from './tour-demo.component';
import { TOUR_DEMO_LOCALES } from './tour-demo.locales';

describe('TourDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(TourDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TOUR_DEMO_LOCALES['en'].card1Title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(TourDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TOUR_DEMO_LOCALES['he'].card1Title);
    expect(fixture.nativeElement.textContent).not.toContain(TOUR_DEMO_LOCALES['en'].card1Title);
  });
});
