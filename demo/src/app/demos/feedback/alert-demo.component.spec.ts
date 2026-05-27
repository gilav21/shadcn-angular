import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertDemoComponent } from './alert-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ALERT_DEMO_LOCALES } from './alert-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('AlertDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<AlertDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AlertDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(AlertDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(ALERT_DEMO_LOCALES['en'].heading);
    });

    it('renders the English info alert title', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(ALERT_DEMO_LOCALES['en'].infoTitle);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<AlertDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AlertDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(AlertDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(ALERT_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew info alert title', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(ALERT_DEMO_LOCALES['he'].infoTitle);
    });
  });
});
