import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
  ViewEncapsulation,
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
import { LucideAngularModule } from 'lucide-angular';
import { PaginationState } from './data-table.types';

@Component({
  selector: 'ui-data-table-pagination',
  standalone: true,
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
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="flex items-center justify-between px-2">
      <div class="flex-1 text-sm text-muted-foreground">
        <!-- Optional: Selected row count could go here -->
      </div>
        <div class="flex items-center space-x-6 lg:space-x-8">
        <div class="flex items-center space-x-2">
          <p class="text-sm font-medium">Rows per page</p>
          <ui-select 
            [ngModel]="pageSizeString()" 
            (ngModelChange)="onPageSizeChange($event)">
              <ui-select-trigger class="h-8 w-[70px]">
                <ui-select-value [placeholder]="pageSizeString()" />
              </ui-select-trigger>
              <ui-select-content side="top">
                @for (size of [10, 20, 30, 40, 50]; track size) {
                  <ui-select-item [value]="size.toString()">
                    {{ size }}
                  </ui-select-item>
                }
              </ui-select-content>
          </ui-select>
        </div>
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
                  <lucide-icon name="chevrons-left" class="h-4 w-4" />
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
                  <lucide-icon name="chevron-left" class="h-4 w-4" />
                </ui-pagination-link>
              </ui-pagination-item>
              
              <div class="flex w-[100px] items-center justify-center text-sm font-medium">
                Page {{ currentPage() }} of {{ totalPages() }}
              </div>

              <ui-pagination-item>
                <ui-pagination-link
                  class="border border-input rounded-md bg-background shadow-sm"
                  size="icon"
                  [disabled]="!canNext()"
                  (click)="onNextPage()"
                >
                  <span class="sr-only">Go to next page</span>
                  <lucide-icon name="chevron-right" class="h-4 w-4" />
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
                  <lucide-icon name="chevrons-right" class="h-4 w-4" />
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
  total = input(0);
  state = input.required<PaginationState>();

  paginationChange = output<PaginationState>();

  pageSizeString = computed(() => this.state().pageSize.toString());
  currentPage = computed(() => this.state().pageIndex + 1);
  totalPages = computed(() => Math.ceil(this.total() / this.state().pageSize));

  canPrevious = computed(() => this.state().pageIndex > 0);
  canNext = computed(() => this.state().pageIndex < this.totalPages() - 1);

  onPageSizeChange(value: string) {
    const pageSize = Number(value);
    this.paginationChange.emit({
      pageIndex: 0, // Reset to first page on size change
      pageSize,
    });
  }

  onFirstPage() {
    this.paginationChange.emit({ ...this.state(), pageIndex: 0 });
  }

  onLastPage() {
    this.paginationChange.emit({ ...this.state(), pageIndex: this.totalPages() - 1 });
  }

  onNextPage() {
    this.paginationChange.emit({ ...this.state(), pageIndex: this.state().pageIndex + 1 });
  }

  onPreviousPage() {
    this.paginationChange.emit({ ...this.state(), pageIndex: this.state().pageIndex - 1 });
  }
}
