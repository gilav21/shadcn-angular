import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableDemoComponent } from './table-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { TABLE_DEMO_LOCALES } from './table-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('TableDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<TableDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TableDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(TableDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(TABLE_DEMO_LOCALES['en'].heading);
    });

    it('renders the English column headers', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(TABLE_DEMO_LOCALES['en'].colInvoice);
      expect(text).toContain(TABLE_DEMO_LOCALES['en'].colStatus);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<TableDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TableDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(TableDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(TABLE_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew column headers', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(TABLE_DEMO_LOCALES['he'].colInvoice);
      expect(text).toContain(TABLE_DEMO_LOCALES['he'].statusPaid);
    });
  });
});
