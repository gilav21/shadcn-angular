import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CarouselDemoComponent } from './carousel-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { CAROUSEL_DEMO_LOCALES } from './carousel-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('CarouselDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<CarouselDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [CarouselDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(CarouselDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(CAROUSEL_DEMO_LOCALES['en'].heading);
    });

    it('renders the English slide label in vertical section', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(CAROUSEL_DEMO_LOCALES['en'].slideLabel);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<CarouselDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [CarouselDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(CarouselDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(CAROUSEL_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew slide label in vertical section', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(CAROUSEL_DEMO_LOCALES['he'].slideLabel);
    });
  });
});
