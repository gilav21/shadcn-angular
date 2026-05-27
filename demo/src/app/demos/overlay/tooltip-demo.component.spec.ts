// demo/src/app/demos/overlay/tooltip-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { TooltipDemoComponent } from './tooltip-demo.component';
import { TOOLTIP_DEMO_LOCALES } from './tooltip-demo.locales';

describe('TooltipDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(TooltipDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TOOLTIP_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(TooltipDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TOOLTIP_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(TOOLTIP_DEMO_LOCALES['en'].title);
  });
});
