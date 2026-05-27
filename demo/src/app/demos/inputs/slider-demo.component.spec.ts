// demo/src/app/demos/inputs/slider-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { SliderDemoComponent } from './slider-demo.component';
import { SLIDER_DEMO_LOCALES } from './slider-demo.locales';

describe('SliderDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(SliderDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(SLIDER_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(SliderDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(SLIDER_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(SLIDER_DEMO_LOCALES['en'].title);
  });
});
