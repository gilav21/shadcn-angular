import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { PageBuilderDemoComponent } from './page-builder-demo.component';
import { PAGE_BUILDER_DEMO_LOCALES } from './page-builder-demo.locales';

describe('PageBuilderDemoComponent', () => {
  it('renders English panel label under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(PageBuilderDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(PAGE_BUILDER_DEMO_LOCALES['en'].panelShow);
  });

  it('renders Hebrew panel label under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(PageBuilderDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(PAGE_BUILDER_DEMO_LOCALES['he'].panelShow);
    expect(fixture.nativeElement.textContent).not.toContain(PAGE_BUILDER_DEMO_LOCALES['en'].panelClickSave);
  });
});
