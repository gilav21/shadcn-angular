import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  SelectComponent,
  SelectTriggerComponent,
  SelectValueComponent,
  SelectContentComponent,
  SelectItemComponent
} from '../../select';
import {
  PaginationComponent,
  PaginationContentComponent,
  PaginationItemComponent,
  PaginationLinkComponent
} from '../../pagination';
import { IconComponent } from '../../icon';
import { PaginationState } from '../data-table.types';
import { isRtl } from '../../../lib/utils';

@Component({
  selector: 'ui-data-table-pagination',
  imports: [
    CommonModule,
    FormsModule,

    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent,
    PaginationComponent,
    PaginationContentComponent,
    PaginationItemComponent,
    PaginationLinkComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table-pagination.component.html',
})
export class DataTablePaginationComponent {
  private readonly _el = inject(ElementRef);

  isRtl() {
    return isRtl(this._el.nativeElement);
  }

  total = input(0);
  state = input.required<PaginationState>();
  pageSizeOptions = input<number[]>([10, 20, 30, 40, 50]);
  showPageSizeSelector = input(true);
  rowsPerPageLabel = input('Rows per page');
  pageLabel = input('Page');
  ofLabel = input('of');

  paginationChange = output<PaginationState>();

  pageSizeString = computed(() => this.state().pageSize.toString());
  currentPage = computed(() => this.state().pageIndex + 1);
  totalPages = computed(() => {
    const pageSize = this.state().pageSize > 0 ? this.state().pageSize : 10;
    return Math.max(1, Math.ceil(this.total() / pageSize));
  });

  canPrevious = computed(() => this.state().pageIndex > 0);
  canNext = computed(() => this.state().pageIndex < this.totalPages() - 1);

  onPageSizeChange(value: string) {
    const pageSize = Number(value);
    this.paginationChange.emit({
      pageIndex: 0,
      pageSize: pageSize > 0 ? pageSize : this.state().pageSize,
    });
  }

  onFirstPage() {
    this.paginationChange.emit({ ...this.state(), pageIndex: 0 });
  }

  onLastPage() {
    this.paginationChange.emit({
      ...this.state(),
      pageIndex: Math.max(0, this.totalPages() - 1),
    });
  }

  onNextPage() {
    this.paginationChange.emit({
      ...this.state(),
      pageIndex: Math.min(this.totalPages() - 1, this.state().pageIndex + 1),
    });
  }

  onPreviousPage() {
    this.paginationChange.emit({
      ...this.state(),
      pageIndex: Math.max(0, this.state().pageIndex - 1),
    });
  }
}
