import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorPageDemoComponent } from './error-page-demo.component';
import { ERROR_PAGE_DEMO_LOCALES } from './error-page-demo.locales';
import { ERROR_PAGE_LOCALES } from '../../../../../packages/components/ui/error-page';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ErrorPageDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<ErrorPageDemoComponent>;
    let root: HTMLElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ErrorPageDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(ErrorPageDemoComponent);
      fixture.detectChanges();
      root = fixture.nativeElement as HTMLElement;
    });

    it('shows the fallback code alongside the switchable shipped ones', () => {
      const codes = Array.from(
        root.querySelectorAll<HTMLElement>('[data-slot="error-page-code"]'),
      ).map(el => el.textContent?.trim());
      expect(codes).toContain('404');
      expect(codes).toContain('418');
    });

    it('switches the shipped-code example through every shipped code', () => {
      const buttons = Array.from(
        root.querySelectorAll<HTMLButtonElement>('ui-button button'),
      );
      for (const code of ['403', '500']) {
        const button = buttons.find(b => b.textContent?.trim() === code);
        expect(button, `expected a ${code} switch button`).toBeTruthy();
        button!.click();
        fixture.detectChanges();

        const shown = Array.from(
          root.querySelectorAll<HTMLElement>('[data-slot="error-page-code"]'),
        ).map(el => el.textContent?.trim());
        expect(shown).toContain(code);
        expect(root.textContent).toContain(
          ERROR_PAGE_LOCALES['en'].codes[code].title,
        );
      }
    });

    it('renders generic copy for the unrecognised code', () => {
      expect(root.textContent).toContain(ERROR_PAGE_LOCALES['en'].fallback.title);
    });

    it('replaces the typographic code where an illustration is projected', () => {
      const illustration = root.querySelector('[data-slot="error-page-illustration"]');
      expect(illustration).toBeTruthy();
      const page = illustration?.closest('[data-slot="error-page"]');
      expect(page?.querySelector('[data-slot="error-page-code"]')).toBeNull();
    });

    it('emits goHome from the default actions rather than routing', () => {
      // The outputs demo is the LAST error-page on the page; earlier ones also
      // render default actions but bind no handlers, so picking the first match
      // would click a button whose emissions nothing is listening for.
      const pages = Array.from(
        root.querySelectorAll<HTMLElement>('[data-slot="error-page"]'),
      );
      const outputsPage = pages.at(-1);
      expect(outputsPage).toBeTruthy();
      expect(
        outputsPage!.querySelector('[data-slot="error-page-code"]')?.textContent?.trim(),
      ).toBe('403');

      const status = root.querySelector('[data-slot="demo-last-event"]');
      expect(status?.textContent).toContain(ERROR_PAGE_DEMO_LOCALES['en'].noEvent);

      outputsPage!
        .querySelector<HTMLButtonElement>('[data-slot="error-page-home"] button')!
        .click();
      fixture.detectChanges();

      expect(
        root.querySelector('[data-slot="demo-last-event"]')?.textContent,
      ).toContain('goHome');
    });
  });
});
