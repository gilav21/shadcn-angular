// demo/src/app/demos/overlay/command-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { CommandDemoComponent } from './command-demo.component';
import { COMMAND_DEMO_LOCALES } from './command-demo.locales';

describe('CommandDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(CommandDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(COMMAND_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(CommandDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(COMMAND_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(COMMAND_DEMO_LOCALES['en'].title);
  });
});
