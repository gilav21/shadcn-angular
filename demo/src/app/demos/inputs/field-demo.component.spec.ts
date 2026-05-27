import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { FieldDemoComponent } from './field-demo.component';
import { FIELD_DEMO_LOCALES } from './field-demo.locales';

describe('FieldDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(FieldDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(FIELD_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(FieldDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(FIELD_DEMO_LOCALES['he'].title);
  });
});
