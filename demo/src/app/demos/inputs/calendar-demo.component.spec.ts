// demo/src/app/demos/inputs/calendar-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { CalendarDemoComponent } from './calendar-demo.component';
import { CALENDAR_DEMO_LOCALES } from './calendar-demo.locales';

describe('CalendarDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(CalendarDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CALENDAR_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(CalendarDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CALENDAR_DEMO_LOCALES['he'].title);
  });
});
