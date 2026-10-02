import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageHeaderDemoComponent } from './page-header-demo.component';
import { PAGE_HEADER_DEMO_LOCALES } from './page-header-demo.locales';

describe('PageHeaderDemoComponent', () => {
  let fixture: ComponentFixture<PageHeaderDemoComponent>;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [PageHeaderDemoComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PageHeaderDemoComponent);
    fixture.detectChanges();
  }

  it('does not introduce a second h1 on a page that already has a heading', async () => {
    await setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1')).toHaveLength(0);
    expect(el.querySelectorAll('[data-slot="page-header-title"]')).toHaveLength(3);
  });

  it('projects the breadcrumb above the title', async () => {
    await setup();
    const el = fixture.nativeElement as HTMLElement;
    const slot = el.querySelector('[data-slot="page-header-breadcrumb"]');
    expect(slot?.textContent).toContain(PAGE_HEADER_DEMO_LOCALES['en'].crumbBilling);
  });
});
