import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BannerDemoComponent } from './banner-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { BANNER_DEMO_LOCALES } from './banner-demo.locales';

describe('BannerDemoComponent', () => {
  let fixture: ComponentFixture<BannerDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [BannerDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(BannerDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(BANNER_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(BANNER_DEMO_LOCALES['en'].warning);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(BANNER_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(BANNER_DEMO_LOCALES['he'].warning);
  });

  it('counts dismissals from the dismissible banner', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    const dismiss = el.querySelector<HTMLButtonElement>('[data-slot="banner-dismiss"] button');
    expect(dismiss).not.toBeNull();
    dismiss?.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="dismiss-count"]')?.textContent?.trim()).toBe('1');
  });
});
