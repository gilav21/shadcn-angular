import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BentoGridDemoComponent } from './bento-grid-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { BENTO_GRID_DEMO_LOCALES } from './bento-grid-demo.locales';

describe('BentoGridDemoComponent', () => {
  let fixture: ComponentFixture<BentoGridDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [BentoGridDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(BentoGridDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(BENTO_GRID_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(BENTO_GRID_DEMO_LOCALES['en'].editLayout);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(BENTO_GRID_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(BENTO_GRID_DEMO_LOCALES['he'].editLayout);
  });
});
