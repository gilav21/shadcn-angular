import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { FormDemoComponent } from './form-demo.component';
import { FORM_DEMO_LOCALES } from './form-demo.locales';

describe('FormDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(FormDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(FORM_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(FormDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(FORM_DEMO_LOCALES['he'].title);
  });
});
