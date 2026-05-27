import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvatarDemoComponent } from './avatar-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { AVATAR_DEMO_LOCALES } from './avatar-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('AvatarDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<AvatarDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AvatarDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(AvatarDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(AVATAR_DEMO_LOCALES['en'].heading);
    });

    it('renders the English description', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(AVATAR_DEMO_LOCALES['en'].description);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<AvatarDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AvatarDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(AvatarDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(AVATAR_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew description', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(AVATAR_DEMO_LOCALES['he'].description);
    });
  });
});
