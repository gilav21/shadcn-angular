import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ToggleDemoComponent } from './toggle-demo.component';
import { TOGGLE_DEMO_LOCALES } from './toggle-demo.locales';

describe('ToggleDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ToggleDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TOGGLE_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(ToggleDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TOGGLE_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(TOGGLE_DEMO_LOCALES['en'].title);
  });
});
