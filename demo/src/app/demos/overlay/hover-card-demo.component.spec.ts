// demo/src/app/demos/overlay/hover-card-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { HoverCardDemoComponent } from './hover-card-demo.component';
import { HOVER_CARD_DEMO_LOCALES } from './hover-card-demo.locales';

describe('HoverCardDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HoverCardDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(HOVER_CARD_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(HoverCardDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(HOVER_CARD_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(HOVER_CARD_DEMO_LOCALES['en'].title);
  });
});
