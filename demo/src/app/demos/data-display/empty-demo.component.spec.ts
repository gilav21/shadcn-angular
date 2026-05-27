import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyDemoComponent } from './empty-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { EMPTY_DEMO_LOCALES } from './empty-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('EmptyDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<EmptyDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [EmptyDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(EmptyDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(EMPTY_DEMO_LOCALES['en'].heading);
    });

    it('renders the English empty state title and button', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(EMPTY_DEMO_LOCALES['en'].emptyTitle);
      expect(text).toContain(EMPTY_DEMO_LOCALES['en'].buttonLabel);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<EmptyDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [EmptyDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(EmptyDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(EMPTY_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew empty state title and button', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(EMPTY_DEMO_LOCALES['he'].emptyTitle);
      expect(text).toContain(EMPTY_DEMO_LOCALES['he'].buttonLabel);
    });
  });
});
