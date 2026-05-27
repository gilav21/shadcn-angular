// demo/src/app/demos/overlay/sheet-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { SheetDemoComponent } from './sheet-demo.component';
import { SHEET_DEMO_LOCALES } from './sheet-demo.locales';

describe('SheetDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(SheetDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(SHEET_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(SheetDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(SHEET_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(SHEET_DEMO_LOCALES['en'].title);
  });
});
