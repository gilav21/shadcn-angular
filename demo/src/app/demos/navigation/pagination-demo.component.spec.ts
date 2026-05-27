// demo/src/app/demos/navigation/pagination-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { PaginationDemoComponent } from './pagination-demo.component';
import { PAGINATION_DEMO_LOCALES } from './pagination-demo.locales';

describe('PaginationDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(PaginationDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(PAGINATION_DEMO_LOCALES['en'].simpleHeading);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(PaginationDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(PAGINATION_DEMO_LOCALES['he'].simpleHeading);
    expect(fixture.nativeElement.textContent).not.toContain(PAGINATION_DEMO_LOCALES['en'].simpleHeading);
  });
});
