// demo/src/app/demos/overlay/speed-dial-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { SpeedDialDemoComponent } from './speed-dial-demo.component';
import { SPEED_DIAL_DEMO_LOCALES } from './speed-dial-demo.locales';

describe('SpeedDialDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(SpeedDialDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(SPEED_DIAL_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(SpeedDialDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(SPEED_DIAL_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(SPEED_DIAL_DEMO_LOCALES['en'].title);
  });
});
