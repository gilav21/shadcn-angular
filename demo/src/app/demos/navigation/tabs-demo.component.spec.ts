import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TabsDemoComponent } from './tabs-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TABS_DEMO_LOCALES } from './tabs-demo.locales';

describe('TabsDemoComponent', () => {
  let fixture: ComponentFixture<TabsDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [TabsDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(TabsDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(TABS_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(TABS_DEMO_LOCALES['en'].tabAccount);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(TABS_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(TABS_DEMO_LOCALES['he'].tabAccount);
  });
});
