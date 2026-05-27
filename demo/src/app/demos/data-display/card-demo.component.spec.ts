import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardDemoComponent } from './card-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { CARD_DEMO_LOCALES } from './card-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('CardDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<CardDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [CardDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(CardDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(CARD_DEMO_LOCALES['en'].heading);
    });

    it('renders the first card title in English', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(CARD_DEMO_LOCALES['en'].card1Title);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<CardDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [CardDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(CardDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(CARD_DEMO_LOCALES['he'].heading);
    });

    it('renders the first card title in Hebrew', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(CARD_DEMO_LOCALES['he'].card1Title);
    });
  });
});
