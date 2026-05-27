import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberTickerDemoComponent } from './number-ticker-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { NUMBER_TICKER_DEMO_LOCALES } from './number-ticker-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('NumberTickerDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<NumberTickerDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [NumberTickerDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(NumberTickerDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(NUMBER_TICKER_DEMO_LOCALES['en'].heading);
    });

    it('renders the English subscribers heading', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(NUMBER_TICKER_DEMO_LOCALES['en'].subscribersHeading);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<NumberTickerDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [NumberTickerDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(NumberTickerDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(NUMBER_TICKER_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew subscribers heading', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(NUMBER_TICKER_DEMO_LOCALES['he'].subscribersHeading);
    });
  });
});
