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
});
