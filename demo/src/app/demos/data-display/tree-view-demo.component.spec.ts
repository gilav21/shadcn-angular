import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeViewDemoComponent } from './tree-view-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { TREE_VIEW_DEMO_LOCALES } from './tree-view-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('TreeViewDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<TreeViewDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TreeViewDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(TreeViewDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(TREE_VIEW_DEMO_LOCALES['en'].heading);
    });

    it('renders the English folder label', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(TREE_VIEW_DEMO_LOCALES['en'].folderDocuments);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<TreeViewDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TreeViewDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(TreeViewDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(TREE_VIEW_DEMO_LOCALES['he'].heading);
    });

    it('renders the Hebrew folder label', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(TREE_VIEW_DEMO_LOCALES['he'].folderDocuments);
    });
  });
});
