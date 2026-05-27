import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NavigationMenuDemoComponent } from './navigation-menu-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { NAVIGATION_MENU_DEMO_LOCALES } from './navigation-menu-demo.locales';

describe('NavigationMenuDemoComponent', () => {
  let fixture: ComponentFixture<NavigationMenuDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [NavigationMenuDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(NavigationMenuDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(NAVIGATION_MENU_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(NAVIGATION_MENU_DEMO_LOCALES['en'].documentation);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(NAVIGATION_MENU_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(NAVIGATION_MENU_DEMO_LOCALES['he'].documentation);
  });
});
