import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { RatingDemoComponent } from './rating-demo.component';
import { RATING_DEMO_LOCALES } from './rating-demo.locales';

describe('RatingDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(RatingDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(RATING_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(RatingDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(RATING_DEMO_LOCALES['he'].title);
  });
});
