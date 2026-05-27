import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { AnimationsDemoComponent } from './animations-demo.component';
import { ANIMATIONS_DEMO_LOCALES } from './animations-demo.locales';

describe('AnimationsDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(AnimationsDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(ANIMATIONS_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(AnimationsDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(ANIMATIONS_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(ANIMATIONS_DEMO_LOCALES['en'].title);
  });
});
