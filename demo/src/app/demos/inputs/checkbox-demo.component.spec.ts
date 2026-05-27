import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CheckboxDemoComponent } from './checkbox-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { CHECKBOX_DEMO_LOCALES } from './checkbox-demo.locales';

describe('CheckboxDemoComponent', () => {
  it('renders English strings by default', async () => {
    TestBed.configureTestingModule({
      imports: [CheckboxDemoComponent],
    });
    const fixture = TestBed.createComponent(CheckboxDemoComponent);
    fixture.detectChanges();

    const en = CHECKBOX_DEMO_LOCALES['en'];
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain(en.heading);
    expect(text).toContain(en.acceptTerms);
    expect(text).toContain(en.subscribeNewsletter);
  });

  it('renders Hebrew strings when provideUiLocale("he") is active', async () => {
    TestBed.configureTestingModule({
      imports: [CheckboxDemoComponent],
      providers: [provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(CheckboxDemoComponent);
    fixture.detectChanges();

    const he = CHECKBOX_DEMO_LOCALES['he'];
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain(he.heading);
    expect(text).toContain(he.acceptTerms);
    expect(text).toContain(he.subscribeNewsletter);

    const section = fixture.debugElement.query(By.css('section'));
    expect(section).toBeTruthy();
  });
});
