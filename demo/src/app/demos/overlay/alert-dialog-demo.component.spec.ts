// demo/src/app/demos/overlay/alert-dialog-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { AlertDialogDemoComponent } from './alert-dialog-demo.component';
import { ALERT_DIALOG_DEMO_LOCALES } from './alert-dialog-demo.locales';

describe('AlertDialogDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(AlertDialogDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(ALERT_DIALOG_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(AlertDialogDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(ALERT_DIALOG_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(ALERT_DIALOG_DEMO_LOCALES['en'].title);
  });
});
