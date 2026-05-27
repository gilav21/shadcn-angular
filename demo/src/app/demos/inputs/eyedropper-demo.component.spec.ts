import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { EyedropperDemoComponent } from './eyedropper-demo.component';
import { EYEDROPPER_DEMO_LOCALES } from './eyedropper-demo.locales';

describe('EyedropperDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(EyedropperDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(EYEDROPPER_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(EyedropperDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(EYEDROPPER_DEMO_LOCALES['he'].title);
  });
});
