// demo/src/app/demos/inputs/switch-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { SwitchDemoComponent } from './switch-demo.component';
import { SWITCH_DEMO_LOCALES } from './switch-demo.locales';

describe('SwitchDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(SwitchDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(SWITCH_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(SwitchDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(SWITCH_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(SWITCH_DEMO_LOCALES['en'].title);
  });
});
