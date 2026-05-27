import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SidebarDemoComponent } from './sidebar-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SIDEBAR_DEMO_LOCALES } from './sidebar-demo.locales';

describe('SidebarDemoComponent', () => {
  let fixture: ComponentFixture<SidebarDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [SidebarDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(SidebarDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(SIDEBAR_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(SIDEBAR_DEMO_LOCALES['en'].navHome);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(SIDEBAR_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(SIDEBAR_DEMO_LOCALES['he'].navHome);
  });
});
