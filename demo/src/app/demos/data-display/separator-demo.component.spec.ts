import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeparatorDemoComponent } from './separator-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { SEPARATOR_DEMO_LOCALES } from './separator-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SeparatorDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<SeparatorDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SeparatorDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(SeparatorDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(SEPARATOR_DEMO_LOCALES['en'].heading);
    });

    it('renders the English library name', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(SEPARATOR_DEMO_LOCALES['en'].libraryName);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<SeparatorDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SeparatorDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(SeparatorDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(SEPARATOR_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew nav blog label', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(SEPARATOR_DEMO_LOCALES['he'].navBlog);
    });
  });
});
