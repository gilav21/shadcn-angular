import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { StepperDemoComponent } from './stepper-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { STEPPER_DEMO_LOCALES } from './stepper-demo.locales';

describe('StepperDemoComponent', () => {
  let fixture: ComponentFixture<StepperDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [StepperDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(StepperDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(STEPPER_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(STEPPER_DEMO_LOCALES['en'].step1Title);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(STEPPER_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(STEPPER_DEMO_LOCALES['he'].step1Title);
  });
});
