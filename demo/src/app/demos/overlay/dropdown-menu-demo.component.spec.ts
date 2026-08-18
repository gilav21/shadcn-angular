// demo/src/app/demos/overlay/dropdown-menu-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { DropdownMenuDemoComponent } from './dropdown-menu-demo.component';
import { DROPDOWN_MENU_DEMO_LOCALES } from './dropdown-menu-demo.locales';

describe('DropdownMenuDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(DropdownMenuDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(DROPDOWN_MENU_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(DropdownMenuDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(DROPDOWN_MENU_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(DROPDOWN_MENU_DEMO_LOCALES['en'].title);
  });

  it('renders the disabled submenu branch example', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(DropdownMenuDemoComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('ui-dropdown-menu')).toHaveLength(3);
    expect(el.textContent).toContain(DROPDOWN_MENU_DEMO_LOCALES['en'].disabledSubHeading);
    expect(el.textContent).toContain(DROPDOWN_MENU_DEMO_LOCALES['en'].disabledSubHint);
    expect(el.textContent).toContain(DROPDOWN_MENU_DEMO_LOCALES['en'].openDisabledSubLabel);
  });
});
