import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ButtonGroupDemoComponent } from './button-group-demo.component';
import { BUTTON_GROUP_DEMO_LOCALES } from './button-group-demo.locales';

describe('ButtonGroupDemoComponent', () => {
  it('renders English labels under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ButtonGroupDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(BUTTON_GROUP_DEMO_LOCALES['en'].title);
    expect(fixture.nativeElement.textContent).toContain(BUTTON_GROUP_DEMO_LOCALES['en'].horizontalLabel);
  });

  it('renders Hebrew labels under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(ButtonGroupDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(BUTTON_GROUP_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).toContain(BUTTON_GROUP_DEMO_LOCALES['he'].horizontalLabel);
    expect(fixture.nativeElement.textContent).not.toContain(BUTTON_GROUP_DEMO_LOCALES['en'].title);
  });
});
