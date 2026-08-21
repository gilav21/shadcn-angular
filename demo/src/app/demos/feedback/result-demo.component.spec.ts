import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResultDemoComponent } from './result-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { RESULT_DEMO_LOCALES } from './result-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ResultDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<ResultDemoComponent>;
    let root: HTMLElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ResultDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(ResultDemoComponent);
      fixture.detectChanges();
      root = fixture.nativeElement as HTMLElement;
    });

    it('renders the English heading', () => {
      expect(root.querySelector('h2')?.textContent).toContain(
        RESULT_DEMO_LOCALES['en'].heading,
      );
    });

    it('renders the English description', () => {
      expect(root.textContent).toContain(RESULT_DEMO_LOCALES['en'].description);
    });

    it('shows all four statuses', () => {
      const statuses = Array.from(
        root.querySelectorAll<HTMLElement>('[data-slot="result-icon"]'),
      ).map(icon => icon.dataset['status']);
      expect(new Set(statuses)).toEqual(
        new Set(['success', 'error', 'warning', 'info']),
      );
    });

    it('announces every panel politely, never assertively', () => {
      const panels = Array.from(
        root.querySelectorAll<HTMLElement>('[data-slot="result"]'),
      );
      expect(panels.length).toBeGreaterThan(0);
      for (const panel of panels) {
        expect(panel.getAttribute('role')).toBe('status');
        expect(panel.getAttribute('aria-live')).toBe('polite');
      }
    });

    it('keeps the projected stack trace out of the actions row', () => {
      const dump = root.querySelector('[data-testid="dump"]');
      expect(dump?.textContent).toContain('TypeError');
      expect(dump?.closest('[data-slot="result-detail"]')).toBeTruthy();
      expect(dump?.closest('[data-slot="result-actions"]')).toBeNull();
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<ResultDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ResultDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(ResultDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = (fixture.nativeElement as HTMLElement).querySelector('h2');
      expect(h2?.textContent).toContain(RESULT_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew description', () => {
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        RESULT_DEMO_LOCALES['he'].description,
      );
    });
  });
});
