import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { VirtualScrollDemoComponent } from './virtual-scroll-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { VIRTUAL_SCROLL_DEMO_LOCALES } from './virtual-scroll-demo.locales';

describe('VirtualScrollDemoComponent', () => {
  let fixture: ComponentFixture<VirtualScrollDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [VirtualScrollDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(VirtualScrollDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(VIRTUAL_SCROLL_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(VIRTUAL_SCROLL_DEMO_LOCALES['en'].loadMore);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(VIRTUAL_SCROLL_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(VIRTUAL_SCROLL_DEMO_LOCALES['he'].loadMore);
  });
});
