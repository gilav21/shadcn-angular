import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DataTablePaginationComponent } from './data-table-pagination.component';

describe('DataTablePaginationComponent', () => {
  let component: DataTablePaginationComponent;
  let fixture: ComponentFixture<DataTablePaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTablePaginationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTablePaginationComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('state', { pageIndex: 0, pageSize: 10 });
    fixture.componentRef.setInput('total', 0);
    fixture.detectChanges();
  });

  it('should never emit negative page index on last page', () => {
    let emitted: any = null;
    component.paginationChange.subscribe(value => {
      emitted = value;
    });

    component.onLastPage();

    expect(emitted).not.toBeNull();
    expect(emitted.pageIndex).toBe(0);
  });

  it('should clamp previous page at zero', () => {
    let emitted: any = null;
    component.paginationChange.subscribe(value => {
      emitted = value;
    });

    component.onPreviousPage();

    expect(emitted.pageIndex).toBe(0);
  });

  it('should render custom pageSizeOptions', () => {
    fixture.componentRef.setInput('pageSizeOptions', [25, 50, 100]);
    fixture.detectChanges();

    expect(component.pageSizeOptions()).toEqual([25, 50, 100]);
  });

  it('should default showPageSizeSelector to true', () => {
    expect(component.showPageSizeSelector()).toBe(true);
  });

  it('should hide rows per page section when showPageSizeSelector is false', () => {
    fixture.componentRef.setInput('showPageSizeSelector', false);
    fixture.detectChanges();

    const rowsPerPageText = fixture.nativeElement.querySelector('p.text-sm');
    expect(rowsPerPageText).toBeNull();
  });

  it('should show rows per page section when showPageSizeSelector is true', () => {
    fixture.componentRef.setInput('showPageSizeSelector', true);
    fixture.detectChanges();

    const rowsPerPageText = fixture.nativeElement.querySelector('p.text-sm');
    expect(rowsPerPageText).not.toBeNull();
    expect(rowsPerPageText.textContent).toContain('Rows per page');
  });
});
