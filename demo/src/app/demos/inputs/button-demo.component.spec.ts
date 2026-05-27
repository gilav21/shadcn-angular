// demo/src/app/demos/inputs/button-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ButtonDemoComponent } from './button-demo.component';
import { BUTTON_DEMO_LOCALES } from './button-demo.locales';

describe('ButtonDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ButtonDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(BUTTON_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(ButtonDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(BUTTON_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(BUTTON_DEMO_LOCALES['en'].title);
  });
});
