import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResultDemoComponent } from './result-demo.component';
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
        // A native <output>, which carries role="status" implicitly — asserting
        // an explicit role attribute would fail while the semantics are right.
        expect(panel.tagName).toBe('OUTPUT');
        expect(panel.getAttribute('aria-live')).toBe('polite');
      }
    });

    it('keeps the projected stack trace out of the actions row', () => {
      const dump = root.querySelector('[data-slot="result-detail"] pre');
      expect(dump?.textContent).toContain('TypeError');
      expect(dump?.closest('[data-slot="result-actions"]')).toBeNull();
    });

    it('opts the detail out of the panel live region', () => {
      const detail = root.querySelector('[data-slot="result-detail"]');
      expect(detail?.getAttribute('aria-live')).toBe('off');
    });
  });
});
