import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { AutocompleteDemoComponent } from './autocomplete-demo.component';
import { AUTOCOMPLETE_DEMO_LOCALES } from './autocomplete-demo.locales';

describe('AutocompleteDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(AutocompleteDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(AUTOCOMPLETE_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(AutocompleteDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(AUTOCOMPLETE_DEMO_LOCALES['he'].title);
  });
});
