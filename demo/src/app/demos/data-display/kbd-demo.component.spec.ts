import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { KbdDemoComponent } from './kbd-demo.component';
import { KBD_DEMO_LOCALES } from './kbd-demo.locales';

describe('KbdDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(KbdDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(KBD_DEMO_LOCALES['en'].title);
    expect(fixture.nativeElement.textContent).toContain(KBD_DEMO_LOCALES['en'].toSearch);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(KbdDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(KBD_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).toContain(KBD_DEMO_LOCALES['he'].toSearch);
  });
});
