import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ChatDemoComponent } from './chat-demo.component';
import { CHAT_DEMO_LOCALES } from './chat-demo.locales';

describe('ChatDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ChatDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CHAT_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(ChatDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CHAT_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(CHAT_DEMO_LOCALES['en'].description);
  });
});
