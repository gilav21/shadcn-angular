import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataListDemoComponent } from './data-list-demo.component';

describe('DataListDemoComponent', () => {
  let fixture: ComponentFixture<DataListDemoComponent>;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [DataListDemoComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DataListDemoComponent);
    fixture.detectChanges();
  }

  it('renders every list as a real dl with paired dt/dd children', async () => {
    await setup();
    const el = fixture.nativeElement as HTMLElement;
    const lists = el.querySelectorAll('dl');
    expect(lists).toHaveLength(3);
    for (const list of lists) {
      const terms = list.querySelectorAll('dt');
      expect(terms.length).toBeGreaterThan(0);
      expect(list.querySelectorAll('dd')).toHaveLength(terms.length);
    }
  });

  it('puts projected content inside the custom-mode value cells', async () => {
    await setup();
    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('[data-slot="badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.closest('dd')).not.toBeNull();
  });
});
