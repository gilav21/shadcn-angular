import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressDemoComponent } from './progress-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { PROGRESS_DEMO_LOCALES } from './progress-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ProgressDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<ProgressDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ProgressDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(ProgressDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(PROGRESS_DEMO_LOCALES['en'].heading);
    });

    it('renders the English description', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(PROGRESS_DEMO_LOCALES['en'].description);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<ProgressDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ProgressDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(ProgressDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(PROGRESS_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew description', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(PROGRESS_DEMO_LOCALES['he'].description);
    });
  });
});
