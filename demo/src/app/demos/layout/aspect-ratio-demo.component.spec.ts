import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AspectRatioDemoComponent } from './aspect-ratio-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ASPECT_RATIO_DEMO_LOCALES } from './aspect-ratio-demo.locales';

describe('AspectRatioDemoComponent', () => {
  let fixture: ComponentFixture<AspectRatioDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [AspectRatioDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(AspectRatioDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(ASPECT_RATIO_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(ASPECT_RATIO_DEMO_LOCALES['en'].label169);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(ASPECT_RATIO_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(ASPECT_RATIO_DEMO_LOCALES['he'].label169);
  });
});
