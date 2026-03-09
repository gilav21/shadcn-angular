import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  PaginationComponent,
  PaginationContentComponent,
  PaginationEllipsisComponent,
  PaginationItemComponent,
  PaginationLinkComponent,
  PaginationNextComponent,
  PaginationPreviousComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-pagination-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PaginationComponent,
    PaginationContentComponent,
    PaginationItemComponent,
    PaginationLinkComponent,
    PaginationPreviousComponent,
    PaginationNextComponent,
    PaginationEllipsisComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="pagination" class="text-2xl font-semibold scroll-m-20">Pagination</h2>
      <p class="text-muted-foreground">Navigate through paged content.</p>

      <ui-pagination>
        <ui-pagination-content>
          <ui-pagination-item>
            <ui-pagination-previous />
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-link [isActive]="true">1</ui-pagination-link>
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-link>2</ui-pagination-link>
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-link>3</ui-pagination-link>
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-ellipsis />
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-next />
          </ui-pagination-item>
        </ui-pagination-content>
      </ui-pagination>

      <h2 id="pagination-secondary" class="text-2xl font-semibold scroll-m-20 mt-12">Pagination</h2>
      <p class="text-muted-foreground">Pagination with page navigation, next and previous links.</p>

      <ui-pagination>
        <ui-pagination-content>
          <ui-pagination-item>
            <ui-pagination-previous href="#" />
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-link href="#">1</ui-pagination-link>
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-link href="#" [isActive]="true">2</ui-pagination-link>
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-link href="#">3</ui-pagination-link>
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-ellipsis />
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-next href="#" />
          </ui-pagination-item>
        </ui-pagination-content>
      </ui-pagination>

      <h3 class="text-lg font-medium mt-8">Simple Mode (Data-driven)</h3>
      <p class="text-muted-foreground text-sm mb-4">Using totalPages and currentPage inputs.</p>
      <ui-pagination [totalPages]="10" [currentPage]="1" />
    </section>
  `,
})
export class PaginationDemoComponent {}
