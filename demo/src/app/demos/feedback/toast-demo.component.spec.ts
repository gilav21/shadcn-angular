import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastDemoComponent } from './toast-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { TOAST_DEMO_LOCALES } from './toast-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ToastDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<ToastDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ToastDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(ToastDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(TOAST_DEMO_LOCALES['en'].heading);
    });

    it('renders the English show toast button', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(TOAST_DEMO_LOCALES['en'].buttonDefault);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<ToastDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ToastDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(ToastDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(TOAST_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew show toast button', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(TOAST_DEMO_LOCALES['he'].buttonDefault);
    });
  });
});
