import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpinnerDemoComponent } from './spinner-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { SPINNER_DEMO_LOCALES } from './spinner-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SpinnerDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<SpinnerDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SpinnerDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(SpinnerDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(SPINNER_DEMO_LOCALES['en'].heading);
    });

    it('renders the English loading button text', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(SPINNER_DEMO_LOCALES['en'].loadingButton);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<SpinnerDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SpinnerDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(SpinnerDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(SPINNER_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew loading button text', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(SPINNER_DEMO_LOCALES['he'].loadingButton);
    });
  });
});
