// demo/src/app/demos/overlay/dialog-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { DialogDemoComponent } from './dialog-demo.component';
import { DIALOG_DEMO_LOCALES } from './dialog-demo.locales';

describe('DialogDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(DialogDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(DIALOG_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(DialogDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(DIALOG_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(DIALOG_DEMO_LOCALES['en'].title);
  });
});
