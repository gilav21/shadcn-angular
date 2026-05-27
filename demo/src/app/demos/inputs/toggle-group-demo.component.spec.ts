import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ToggleGroupDemoComponent } from './toggle-group-demo.component';
import { TOGGLE_GROUP_DEMO_LOCALES } from './toggle-group-demo.locales';

describe('ToggleGroupDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ToggleGroupDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TOGGLE_GROUP_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(ToggleGroupDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TOGGLE_GROUP_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(TOGGLE_GROUP_DEMO_LOCALES['en'].title);
  });
});
