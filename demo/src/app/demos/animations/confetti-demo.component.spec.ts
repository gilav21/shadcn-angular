import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ConfettiDemoComponent } from './confetti-demo.component';
import { CONFETTI_DEMO_LOCALES } from './confetti-demo.locales';

describe('ConfettiDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ConfettiDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CONFETTI_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(ConfettiDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CONFETTI_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(CONFETTI_DEMO_LOCALES['en'].title);
  });
});
