import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatCardDemoComponent } from './stat-card-demo.component';
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
});
