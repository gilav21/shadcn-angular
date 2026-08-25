import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatCardDemoComponent } from './stat-card-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { STAT_CARD_DEMO_LOCALES } from './stat-card-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('StatCardDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<StatCardDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [StatCardDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(StatCardDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(STAT_CARD_DEMO_LOCALES['en'].heading);
    });

    it('renders the English description', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(STAT_CARD_DEMO_LOCALES['en'].description);
    });

    it('renders a tile for every trend treatment', () => {
      const badges = fixture.nativeElement.querySelectorAll('[data-slot="badge"]');
      expect(badges.length).toBeGreaterThanOrEqual(3);
      const classes = Array.from(badges).flatMap(badge =>
        Array.from((badge as HTMLElement).classList),
      );
      expect(classes).toContain('bg-primary');
      expect(classes).toContain('bg-destructive');
      expect(classes).toContain('bg-secondary');
    });

    it('shows a tile with no delta badge at all', () => {
      const openTickets = Array.from(
        fixture.nativeElement.querySelectorAll('ui-stat-card'),
      ).find(card =>
        (card as HTMLElement).textContent?.includes(
          STAT_CARD_DEMO_LOCALES['en'].openTickets,
        ),
      ) as HTMLElement | undefined;
      expect(openTickets).toBeTruthy();
      expect(openTickets?.querySelector('[data-slot="badge"]')).toBeNull();
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<StatCardDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [StatCardDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(StatCardDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(STAT_CARD_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew description', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(STAT_CARD_DEMO_LOCALES['he'].description);
    });
  });
});
