import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MasonryDemoComponent } from './masonry-demo.component';

describe('MasonryDemoComponent', () => {
  let fixture: ComponentFixture<MasonryDemoComponent>;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [MasonryDemoComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MasonryDemoComponent);
    fixture.detectChanges();
  }

  function cardIds(): (string | undefined)[] {
    const el = fixture.nativeElement as HTMLElement;
    return [...el.querySelectorAll<HTMLElement>('[data-card-id]')].map((card) => card.dataset['cardId']);
  }

  it('keeps the cards in source order in the DOM', async () => {
    await setup();
    expect(cardIds()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('appends a card without disturbing the existing ones', async () => {
    await setup();
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
    await setup();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll<HTMLButtonElement>('button');
    buttons[1].click();
    fixture.detectChanges();

    expect(cardIds()).not.toContain('9');
    expect(el.querySelector('[data-testid="card-count"]')?.textContent?.trim()).toBe('8');
  });
});
