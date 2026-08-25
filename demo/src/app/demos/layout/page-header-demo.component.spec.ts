import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PageHeaderDemoComponent } from './page-header-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { PAGE_HEADER_DEMO_LOCALES } from './page-header-demo.locales';

describe('PageHeaderDemoComponent', () => {
  let fixture: ComponentFixture<PageHeaderDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [PageHeaderDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(PageHeaderDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(PAGE_HEADER_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(PAGE_HEADER_DEMO_LOCALES['en'].pageDescription);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(PAGE_HEADER_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(PAGE_HEADER_DEMO_LOCALES['he'].pageDescription);
  });

  it('does not introduce a second h1 on a page that already has a heading', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1')).toHaveLength(0);
    expect(el.querySelectorAll('[data-slot="page-header-title"]')).toHaveLength(3);
  });

  it('projects the breadcrumb above the title', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    const slot = el.querySelector('[data-slot="page-header-breadcrumb"]');
    expect(slot?.textContent).toContain(PAGE_HEADER_DEMO_LOCALES['en'].crumbBilling);
  });
});
