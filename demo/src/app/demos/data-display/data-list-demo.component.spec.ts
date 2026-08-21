import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DataListDemoComponent } from './data-list-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { DATA_LIST_DEMO_LOCALES } from './data-list-demo.locales';

describe('DataListDemoComponent', () => {
  let fixture: ComponentFixture<DataListDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [DataListDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(DataListDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(DATA_LIST_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(DATA_LIST_DEMO_LOCALES['en'].valueEnterprise);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(DATA_LIST_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(DATA_LIST_DEMO_LOCALES['he'].valueEnterprise);
  });

  it('renders every list as a real dl with paired dt/dd children', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    const lists = el.querySelectorAll('dl');
    expect(lists).toHaveLength(3);
    for (const list of lists) {
      const terms = list.querySelectorAll('dt');
      expect(terms.length).toBeGreaterThan(0);
      expect(list.querySelectorAll('dd')).toHaveLength(terms.length);
    }
  });

  it('puts projected content inside the custom-mode value cells', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('[data-slot="badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.closest('dd')).not.toBeNull();
  });
});
