import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconDemoComponent } from './icon-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ICON_DEMO_LOCALES } from './icon-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('IconDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<IconDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [IconDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(IconDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(ICON_DEMO_LOCALES['en'].heading);
    });

    it('renders the English sizes section heading', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(ICON_DEMO_LOCALES['en'].sectionSizes);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<IconDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [IconDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(IconDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(ICON_DEMO_LOCALES['he'].heading);
    });

    it('renders Hebrew category labels', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(ICON_DEMO_LOCALES['he'].categoryLabels[0]);
    });
  });
});
