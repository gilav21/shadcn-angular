// demo/src/app/demos/inputs/label-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { LabelDemoComponent } from './label-demo.component';
import { LABEL_DEMO_LOCALES } from './label-demo.locales';

describe('LabelDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(LabelDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(LABEL_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(LabelDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(LABEL_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(LABEL_DEMO_LOCALES['en'].title);
  });
});
