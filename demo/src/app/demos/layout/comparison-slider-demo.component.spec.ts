import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ComparisonSliderDemoComponent } from './comparison-slider-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { COMPARISON_SLIDER_DEMO_LOCALES } from './comparison-slider-demo.locales';

describe('ComparisonSliderDemoComponent', () => {
  let fixture: ComponentFixture<ComparisonSliderDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [ComparisonSliderDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(ComparisonSliderDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(COMPARISON_SLIDER_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(COMPARISON_SLIDER_DEMO_LOCALES['en'].beforeLabel);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(COMPARISON_SLIDER_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(COMPARISON_SLIDER_DEMO_LOCALES['he'].beforeLabel);
  });
});
