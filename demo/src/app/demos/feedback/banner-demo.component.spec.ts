import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BannerDemoComponent } from './banner-demo.component';

describe('BannerDemoComponent', () => {
  let fixture: ComponentFixture<BannerDemoComponent>;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [BannerDemoComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BannerDemoComponent);
    fixture.detectChanges();
  }

  it('counts dismissals from the dismissible banner', async () => {
    await setup();
    const el = fixture.nativeElement as HTMLElement;
    const dismiss = el.querySelector<HTMLButtonElement>('[data-slot="banner-dismiss"] button');
    expect(dismiss).not.toBeNull();
    dismiss?.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="dismiss-count"]')?.textContent?.trim()).toBe('1');
  });
});
