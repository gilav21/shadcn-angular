import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ResizableDemoComponent } from './resizable-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { RESIZABLE_DEMO_LOCALES } from './resizable-demo.locales';

describe('ResizableDemoComponent', () => {
  let fixture: ComponentFixture<ResizableDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [ResizableDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(ResizableDemoComponent);
    fixture.detectChanges();
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(RESIZABLE_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(RESIZABLE_DEMO_LOCALES['en'].horizontalHeading);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(RESIZABLE_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(RESIZABLE_DEMO_LOCALES['he'].horizontalHeading);
  });
});
