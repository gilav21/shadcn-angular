import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableDemoComponent } from './data-table-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { DATA_TABLE_DEMO_LOCALES } from './data-table-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('DataTableDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<DataTableDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [DataTableDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(DataTableDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English guide heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(DATA_TABLE_DEMO_LOCALES['en'].guideHeading);
    });

    it('renders English category card headings', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(DATA_TABLE_DEMO_LOCALES['en'].cardDataRendering);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<DataTableDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [DataTableDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(DataTableDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew guide heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(DATA_TABLE_DEMO_LOCALES['he'].guideHeading);
    });

    it('renders Hebrew category card headings', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(DATA_TABLE_DEMO_LOCALES['he'].cardDataRendering);
    });
  });
});
