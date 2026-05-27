import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileViewerDemoComponent } from './file-viewer-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { FILE_VIEWER_DEMO_LOCALES } from './file-viewer-demo.locales';
import { describe, it, expect, beforeEach } from 'vitest';

describe('FileViewerDemoComponent', () => {
  describe('English (default)', () => {
    let fixture: ComponentFixture<FileViewerDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [FileViewerDemoComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(FileViewerDemoComponent);
      fixture.detectChanges();
    });

    it('renders the English heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(FILE_VIEWER_DEMO_LOCALES['en'].heading);
    });

    it('renders English button labels', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(FILE_VIEWER_DEMO_LOCALES['en'].buttonTextFile);
      expect(text).toContain(FILE_VIEWER_DEMO_LOCALES['en'].tryOwnFileHeading);
    });
  });

  describe('Hebrew (provideUiLocale)', () => {
    let fixture: ComponentFixture<FileViewerDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [FileViewerDemoComponent],
        providers: [provideUiLocale('he')],
      }).compileComponents();
      fixture = TestBed.createComponent(FileViewerDemoComponent);
      fixture.detectChanges();
    });

    it('renders the Hebrew heading', () => {
      const h2 = fixture.nativeElement.querySelector('h2');
      expect(h2.textContent).toContain(FILE_VIEWER_DEMO_LOCALES['he'].heading);
    });

    it('renders Hebrew button labels', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(FILE_VIEWER_DEMO_LOCALES['he'].buttonTextFile);
      expect(text).toContain(FILE_VIEWER_DEMO_LOCALES['he'].tryOwnFileHeading);
    });
  });
});
