import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DataTablePaginationComponent } from './data-table-pagination.component';
import { PaginationState } from '../data-table.types';

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

  describe('navigation and page-size emissions', () => {
    let captured: PaginationState | null;

    beforeEach(() => {
      captured = null;
      component.paginationChange.subscribe((v) => (captured = v));
    });

    it('emits pageIndex 0 while preserving pageSize on first page', () => {
      fixture.componentRef.setInput('state', { pageIndex: 3, pageSize: 20 });
      fixture.componentRef.setInput('total', 200);
      fixture.detectChanges();

      component.onFirstPage();

      expect(captured).toEqual({ pageIndex: 0, pageSize: 20 });
    });

    it('advances to the next page when not on the last page', () => {
      fixture.componentRef.setInput('state', { pageIndex: 0, pageSize: 10 });
      fixture.componentRef.setInput('total', 100);
      fixture.detectChanges();

      component.onNextPage();

      expect(captured?.pageIndex).toBe(1);
    });

    it('clamps the next page at the last page', () => {
      fixture.componentRef.setInput('state', { pageIndex: 9, pageSize: 10 });
      fixture.componentRef.setInput('total', 100);
      fixture.detectChanges();

      component.onNextPage();

      expect(captured?.pageIndex).toBe(9);
    });

    it('resets to first page and applies a new page size', () => {
      fixture.componentRef.setInput('state', { pageIndex: 4, pageSize: 10 });
      fixture.detectChanges();

      component.onPageSizeChange('25');

      expect(captured).toEqual({ pageIndex: 0, pageSize: 25 });
    });

    it('keeps the current page size when the requested size is not positive', () => {
      fixture.componentRef.setInput('state', { pageIndex: 2, pageSize: 30 });
      fixture.detectChanges();

      component.onPageSizeChange('0');

      expect(captured).toEqual({ pageIndex: 0, pageSize: 30 });
    });
  });

  it('treats a non-positive page size as 10 when computing total pages', () => {
    fixture.componentRef.setInput('state', { pageIndex: 0, pageSize: 0 });
    fixture.componentRef.setInput('total', 25);
    fixture.detectChanges();

    expect(component.totalPages()).toBe(3);
  });
});
