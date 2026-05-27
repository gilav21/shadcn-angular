import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeDemoComponent } from './badge-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { BADGE_DEMO_LOCALES } from './badge-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('BadgeDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<BadgeDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [BadgeDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(BadgeDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(BADGE_DEMO_LOCALES['en'].heading);
    });

    it('renders English badge labels', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(BADGE_DEMO_LOCALES['en'].labelDefault);
      expect(text).toContain(BADGE_DEMO_LOCALES['en'].labelSecondary);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<BadgeDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [BadgeDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(BadgeDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(BADGE_DEMO_LOCALES['he'].heading);
    });

    it('renders Hebrew badge labels', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(BADGE_DEMO_LOCALES['he'].labelDefault);
      expect(text).toContain(BADGE_DEMO_LOCALES['he'].labelSecondary);
    });
  });
});
