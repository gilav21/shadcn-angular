import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccordionDemoComponent } from './accordion-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ACCORDION_DEMO_LOCALES } from './accordion-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('AccordionDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<AccordionDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AccordionDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(AccordionDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(ACCORDION_DEMO_LOCALES['en'].heading);
    });

    it('renders the first accordion question in English', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(ACCORDION_DEMO_LOCALES['en'].item1Question);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<AccordionDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AccordionDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(AccordionDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(ACCORDION_DEMO_LOCALES['he'].heading);
    });

    it('renders the first accordion question in Hebrew', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(ACCORDION_DEMO_LOCALES['he'].item1Question);
    });
  });
});
