// demo/src/app/demos/introduction.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../packages/components/lib/i18n';
import { IntroductionComponent } from './introduction.component';
import { INTRODUCTION_LOCALES } from './introduction.locales';

describe('IntroductionComponent', () => {
  it('renders English body under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(IntroductionComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(INTRODUCTION_LOCALES.en.body);
  });

  it('renders Hebrew body under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(IntroductionComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(INTRODUCTION_LOCALES.he.body);
    expect(fixture.nativeElement.textContent).not.toContain(INTRODUCTION_LOCALES.en.body);
  });
});
