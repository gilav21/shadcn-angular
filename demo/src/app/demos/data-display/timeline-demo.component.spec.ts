import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimelineDemoComponent } from './timeline-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { TIMELINE_DEMO_LOCALES } from './timeline-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('TimelineDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<TimelineDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TimelineDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(TimelineDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(TIMELINE_DEMO_LOCALES['en'].heading);
    });

    it('renders the first event title in English', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(TIMELINE_DEMO_LOCALES['en'].event1Title);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<TimelineDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TimelineDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(TimelineDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(TIMELINE_DEMO_LOCALES['he'].heading);
    });

    it('renders the first event title in Hebrew', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(TIMELINE_DEMO_LOCALES['he'].event1Title);
    });
  });
});
