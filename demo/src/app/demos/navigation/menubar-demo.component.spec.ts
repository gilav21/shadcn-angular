import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MenubarDemoComponent } from './menubar-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { MENUBAR_DEMO_LOCALES } from './menubar-demo.locales';

describe('MenubarDemoComponent', () => {
  let fixture: ComponentFixture<MenubarDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [MenubarDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(MenubarDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(MENUBAR_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(MENUBAR_DEMO_LOCALES['en'].menuFile);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(MENUBAR_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(MENUBAR_DEMO_LOCALES['he'].menuFile);
  });
});
