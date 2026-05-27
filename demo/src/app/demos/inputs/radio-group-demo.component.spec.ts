// demo/src/app/demos/inputs/radio-group-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { RadioGroupDemoComponent } from './radio-group-demo.component';
import { RADIO_GROUP_DEMO_LOCALES } from './radio-group-demo.locales';

describe('RadioGroupDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(RadioGroupDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(RADIO_GROUP_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(RadioGroupDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(RADIO_GROUP_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(RADIO_GROUP_DEMO_LOCALES['en'].title);
  });
});
