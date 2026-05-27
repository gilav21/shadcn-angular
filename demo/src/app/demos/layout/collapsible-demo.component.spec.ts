import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CollapsibleDemoComponent } from './collapsible-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { COLLAPSIBLE_DEMO_LOCALES } from './collapsible-demo.locales';

describe('CollapsibleDemoComponent', () => {
  let fixture: ComponentFixture<CollapsibleDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [CollapsibleDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(CollapsibleDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(COLLAPSIBLE_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(COLLAPSIBLE_DEMO_LOCALES['en'].starredLabel);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(COLLAPSIBLE_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(COLLAPSIBLE_DEMO_LOCALES['he'].starredLabel);
  });
});
