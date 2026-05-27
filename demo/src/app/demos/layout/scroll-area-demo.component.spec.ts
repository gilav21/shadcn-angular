import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ScrollAreaDemoComponent } from './scroll-area-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SCROLL_AREA_DEMO_LOCALES } from './scroll-area-demo.locales';

describe('ScrollAreaDemoComponent', () => {
  let fixture: ComponentFixture<ScrollAreaDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [ScrollAreaDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(ScrollAreaDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(SCROLL_AREA_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(SCROLL_AREA_DEMO_LOCALES['en'].tagsLabel);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(SCROLL_AREA_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(SCROLL_AREA_DEMO_LOCALES['he'].tagsLabel);
  });
});
