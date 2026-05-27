import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ChipListDemoComponent } from './chip-list-demo.component';
import { CHIP_LIST_DEMO_LOCALES } from './chip-list-demo.locales';

describe('ChipListDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ChipListDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CHIP_LIST_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(ChipListDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CHIP_LIST_DEMO_LOCALES['he'].title);
  });
});
