import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreadcrumbDemoComponent } from './breadcrumb-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { BREADCRUMB_DEMO_LOCALES } from './breadcrumb-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('BreadcrumbDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<BreadcrumbDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [BreadcrumbDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(BreadcrumbDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(BREADCRUMB_DEMO_LOCALES['en'].heading);
    });

    it('renders English crumb labels', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(BREADCRUMB_DEMO_LOCALES['en'].crumbHome);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<BreadcrumbDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [BreadcrumbDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(BreadcrumbDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(BREADCRUMB_DEMO_LOCALES['he'].heading);
    });

    it('renders Hebrew crumb labels', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(BREADCRUMB_DEMO_LOCALES['he'].crumbHome);
    });
  });
});
