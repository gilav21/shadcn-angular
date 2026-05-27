import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CodeBlockDemoComponent } from './code-block-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { CODE_BLOCK_DEMO_LOCALES } from './code-block-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('CodeBlockDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<CodeBlockDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [CodeBlockDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(CodeBlockDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(CODE_BLOCK_DEMO_LOCALES['en'].heading);
    });

    it('renders the English collapsible section heading', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(CODE_BLOCK_DEMO_LOCALES['en'].collapsibleHeading);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<CodeBlockDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [CodeBlockDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(CodeBlockDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(CODE_BLOCK_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew collapsible section heading', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(CODE_BLOCK_DEMO_LOCALES['he'].collapsibleHeading);
    });
  });
});
