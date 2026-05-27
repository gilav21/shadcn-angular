// demo/src/app/demos/inputs/textarea-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { TextareaDemoComponent } from './textarea-demo.component';
import { TEXTAREA_DEMO_LOCALES } from './textarea-demo.locales';

describe('TextareaDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(TextareaDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TEXTAREA_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(TextareaDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TEXTAREA_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(TEXTAREA_DEMO_LOCALES['en'].title);
  });
});
