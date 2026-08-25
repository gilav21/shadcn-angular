import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MasonryDemoComponent } from './masonry-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { MASONRY_DEMO_LOCALES } from './masonry-demo.locales';

describe('MasonryDemoComponent', () => {
  let fixture: ComponentFixture<MasonryDemoComponent>;

  async function setup(locale: string) {
    await TestBed.configureTestingModule({
      imports: [MasonryDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
    }).compileComponents();
    fixture = TestBed.createComponent(MasonryDemoComponent);
    fixture.detectChanges();
  }

  function cardIds(): (string | undefined)[] {
    const el = fixture.nativeElement as HTMLElement;
    return [...el.querySelectorAll<HTMLElement>('[data-card-id]')].map((card) => card.dataset['cardId']);
  }

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(MASONRY_DEMO_LOCALES['en'].heading);
    expect(el.textContent).toContain(MASONRY_DEMO_LOCALES['en'].domOrderNote);
  });

  it('renders Hebrew when locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(MASONRY_DEMO_LOCALES['he'].heading);
    expect(el.textContent).toContain(MASONRY_DEMO_LOCALES['he'].domOrderNote);
  });

  it('keeps the cards in source order in the DOM', async () => {
    await setup('en');
    expect(cardIds()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('appends a card without disturbing the existing ones', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    const before = [...el.querySelectorAll('[data-card-id]')];

    const buttons = el.querySelectorAll<HTMLButtonElement>('button');
    buttons[0].click();
    fixture.detectChanges();

    const after = [...el.querySelectorAll('[data-card-id]')];
    expect(after).toHaveLength(before.length + 1);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(el.querySelector('[data-testid="card-count"]')?.textContent?.trim()).toBe('10');
  });

  it('removes the last card', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll<HTMLButtonElement>('button');
    buttons[1].click();
    fixture.detectChanges();

    expect(cardIds()).not.toContain('9');
    expect(el.querySelector('[data-testid="card-count"]')?.textContent?.trim()).toBe('8');
  });
});
