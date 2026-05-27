// demo/src/app/demos/inputs/input-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { InputDemoComponent } from './input-demo.component';
import { INPUT_DEMO_LOCALES } from './input-demo.locales';

describe('InputDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(InputDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(INPUT_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(InputDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(INPUT_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(INPUT_DEMO_LOCALES['en'].title);
  });
});
