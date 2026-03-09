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
} from '../select.component';
import {
  PaginationComponent,
  PaginationContentComponent,
  PaginationItemComponent,
  PaginationLinkComponent
} from '../pagination.component';
import { IconComponent } from '../icon.component';
import { PaginationState } from './data-table.types';
import { isRtl } from '../../lib/utils';

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
  template: `
    <div class="flex items-center justify-between px-2">
      <div class="flex-1 text-sm text-muted-foreground">
      </div>
        <div class="flex items-center space-x-6 lg:space-x-8">
        @if (showPageSizeSelector()) {
        <div class="flex items-center space-x-2">
          <p class="text-sm font-medium">{{ rowsPerPageLabel() }}</p>
          <ui-select
            [ngModel]="pageSizeString()"
            (ngModelChange)="onPageSizeChange($event)">
              <ui-select-trigger class="h-8 w-[70px]">
                <ui-select-value [placeholder]="pageSizeString()" />
              </ui-select-trigger>
              <ui-select-content side="top">
                @for (size of pageSizeOptions(); track size) {
                  <ui-select-item [value]="size.toString()">
                    {{ size }}
                  </ui-select-item>
                }
              </ui-select-content>
          </ui-select>
        </div>
        }
        <div class="flex items-center space-x-2">
          <ui-pagination [class]="'mx-0 w-auto'">
            <ui-pagination-content>
              <ui-pagination-item>
                <ui-pagination-link
                  class="hidden lg:flex border border-input rounded-md bg-background shadow-sm"
                  size="icon"
                  [disabled]="!canPrevious()"
                  (click)="onFirstPage()"
                >
                  <span class="sr-only">Go to first page</span>
                  <ui-icon [name]="isRtl() ? 'chevrons-right' : 'chevrons-left'" class="h-4 w-4" />
                </ui-pagination-link>
              </ui-pagination-item>
              <ui-pagination-item>
                <ui-pagination-link
                  class="border border-input rounded-md bg-background shadow-sm"
                  size="icon"
                  [disabled]="!canPrevious()"
                  (click)="onPreviousPage()"
                >
                  <span class="sr-only">Go to previous page</span>
                  <ui-icon [name]="isRtl() ? 'chevron-right' : 'chevron-left'" class="h-4 w-4" />
                </ui-pagination-link>
              </ui-pagination-item>
              
              <div class="flex w-[100px] items-center justify-center text-sm font-medium">
                {{ pageLabel() }} {{ currentPage() }} {{ ofLabel() }} {{ totalPages() }}
              </div>

              <ui-pagination-item>
                <ui-pagination-link
                  class="border border-input rounded-md bg-background shadow-sm"
                  size="icon"
                  [disabled]="!canNext()"
                  (click)="onNextPage()"
                >
                  <span class="sr-only">Go to next page</span>
                  <ui-icon [name]="isRtl() ? 'chevron-left' : 'chevron-right'" class="h-4 w-4" />
                </ui-pagination-link>
              </ui-pagination-item>
              <ui-pagination-item>
                <ui-pagination-link
                  class="hidden lg:flex border border-input rounded-md bg-background shadow-sm"
                  size="icon"
                  [disabled]="!canNext()"
                  (click)="onLastPage()"
                >
                  <span class="sr-only">Go to last page</span>
                  <ui-icon [name]="isRtl() ? 'chevrons-left' : 'chevrons-right'" class="h-4 w-4" />
                </ui-pagination-link>
              </ui-pagination-item>
            </ui-pagination-content>
          </ui-pagination>
        </div>
      </div>
    </div>
  `,
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
