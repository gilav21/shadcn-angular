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

  /**
   * True when the host's resolved writing direction is RTL. Used only to mirror
   * the chevron icons — the button order itself is left to the flex layout.
   * Read from the live DOM, so it is not reactive to a `dir` change.
   */
  isRtl(): boolean {
    return isRtl(this._el.nativeElement);
  }

  /**
   * Total row count across all pages (not the current page's length). Drives the
   * page count and therefore the next/last disabled state; leave it at 0 and the
   * control collapses to a single page.
   */
  total = input(0);
  /**
   * The controlled page index + size. Nothing is stored locally: the buttons
   * only emit a new state on {@link paginationChange}, so the display does not
   * move until you feed the value back in.
   */
  state = input.required<PaginationState>();
  /** Choices in the page-size select. A size not in this list still displays, as the placeholder. */
  pageSizeOptions = input<number[]>([10, 20, 30, 40, 50]);
  /** Hides the page-size select when false; the page buttons remain. */
  showPageSizeSelector = input(true);
  /** Label beside the page-size select; hidden below the `sm` breakpoint. */
  rowsPerPageLabel = input('Rows per page');
  /** Prefix of the "Page X of Y" indicator. */
  pageLabel = input('Page');
  /** The word between current page and total pages in "Page X of Y". */
  ofLabel = input('of');

  /**
   * The requested next state, already clamped to `[0, totalPages - 1]`. Changing
   * the page size resets `pageIndex` to 0. The component never paginates data
   * itself — slice your rows from this.
   */
  paginationChange = output<PaginationState>();

  pageSizeString = computed(() => this.state().pageSize.toString());
  currentPage = computed(() => this.state().pageIndex + 1);
  totalPages = computed(() => {
    const pageSize = this.state().pageSize > 0 ? this.state().pageSize : 10;
    return Math.max(1, Math.ceil(this.total() / pageSize));
  });

  canPrevious = computed(() => this.state().pageIndex > 0);
  canNext = computed(() => this.state().pageIndex < this.totalPages() - 1);

  /**
   * Emits the new page size and jumps back to the first page. A non-numeric or
   * non-positive `value` keeps the current size (but still resets to page 0).
   */
  onPageSizeChange(value: string): void {
    const pageSize = Number(value);
    this.paginationChange.emit({
      pageIndex: 0,
      pageSize: pageSize > 0 ? pageSize : this.state().pageSize,
    });
  }

  /** Emits page 0, keeping the page size. The button is hidden below the `lg` breakpoint. */
  onFirstPage(): void {
    this.paginationChange.emit({ ...this.state(), pageIndex: 0 });
  }

  /**
   * Emits the last page index derived from {@link total} and the current page
   * size. Hidden below the `lg` breakpoint, so it is not the only way to reach
   * the end on mobile.
   */
  onLastPage(): void {
    this.paginationChange.emit({
      ...this.state(),
      pageIndex: Math.max(0, this.totalPages() - 1),
    });
  }

  /** Emits the next page, clamped to the last page; the button is disabled there anyway. */
  onNextPage(): void {
    this.paginationChange.emit({
      ...this.state(),
      pageIndex: Math.min(this.totalPages() - 1, this.state().pageIndex + 1),
    });
  }

  /** Emits the previous page, clamped at 0; the button is disabled on the first page. */
  onPreviousPage(): void {
    this.paginationChange.emit({
      ...this.state(),
      pageIndex: Math.max(0, this.state().pageIndex - 1),
    });
  }
}
