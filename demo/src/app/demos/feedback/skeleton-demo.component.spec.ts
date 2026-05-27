import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SkeletonDemoComponent } from './skeleton-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { SKELETON_DEMO_LOCALES } from './skeleton-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SkeletonDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<SkeletonDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SkeletonDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(SkeletonDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(SKELETON_DEMO_LOCALES['en'].heading);
    });

    it('renders the English description', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(SKELETON_DEMO_LOCALES['en'].description);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<SkeletonDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SkeletonDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(SkeletonDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(SKELETON_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew description', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(SKELETON_DEMO_LOCALES['he'].description);
    });
  });
});
