import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ColorPickerDemoComponent } from './color-picker-demo.component';
import { COLOR_PICKER_DEMO_LOCALES } from './color-picker-demo.locales';

describe('ColorPickerDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ColorPickerDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(COLOR_PICKER_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(ColorPickerDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(COLOR_PICKER_DEMO_LOCALES['he'].title);
  });
});
