import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { AlertDemoComponent } from './alert-demo.component';
import { ALERT_DEMO_LOCALES } from './alert-demo.locales';

/**
 * Stands for every demo page: they all read their strings from the injected
 * locale in the same way, and `locales.spec.ts` checks the dictionaries they
 * read. One mount per locale is enough to show that wiring is live.
 */
describe('demo pages read the injected locale', () => {
  function mount(providers: Provider[]): HTMLElement {
    TestBed.configureTestingModule({ imports: [AlertDemoComponent], providers });
    const fixture = TestBed.createComponent(AlertDemoComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders English by default', () => {
    const el = mount([]);
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(ALERT_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(ALERT_DEMO_LOCALES['en'].infoTitle);
  });

  it('renders Hebrew under provideUiLocale("he") and none of the English', () => {
    const el = mount([provideUiLocale('he')]);
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(ALERT_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(ALERT_DEMO_LOCALES['he'].infoTitle);
    expect(el.textContent).not.toContain(ALERT_DEMO_LOCALES['en'].infoTitle);
  });
});
