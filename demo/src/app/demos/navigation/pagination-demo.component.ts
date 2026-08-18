// demo/src/app/demos/navigation/pagination-demo.component.ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  PaginationComponent,
  PaginationContentComponent,
  PaginationEllipsisComponent,
  PaginationItemComponent,
  PaginationLinkComponent,
  PaginationNextComponent,
  PaginationPreviousComponent,
} from '../../../../../packages/components/ui';
import { PAGINATION_DEMO_LOCALES } from './pagination-demo.locales';

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
      <h2 id="pagination" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-pagination>
        <ui-pagination-content>
          <ui-pagination-item><ui-pagination-previous /></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link [isActive]="true">1</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link>2</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link>3</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-ellipsis /></ui-pagination-item>
          <ui-pagination-item><ui-pagination-next /></ui-pagination-item>
        </ui-pagination-content>
      </ui-pagination>

      <h2 id="pagination-secondary" class="text-2xl font-semibold scroll-m-20 mt-12">{{ t().secondaryTitle }}</h2>
      <p class="text-muted-foreground">{{ t().secondaryDescription }}</p>

      <ui-pagination>
        <ui-pagination-content>
          <ui-pagination-item><ui-pagination-previous href="#" /></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link href="#">1</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link href="#" [isActive]="true">2</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link href="#">3</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-ellipsis /></ui-pagination-item>
          <ui-pagination-item><ui-pagination-next href="#" /></ui-pagination-item>
        </ui-pagination-content>
      </ui-pagination>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDescription }}</p>
      <ui-pagination [totalPages]="10" [currentPage]="1" />

      <h3 class="text-lg font-medium mt-8">{{ t().ellipsisHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().ellipsisDescription }}</p>
      <ui-pagination [totalPages]="20" [currentPage]="ellipsisPage()" (pageChange)="ellipsisPage.set($event)" />
      <p class="text-center text-sm text-muted-foreground">
        {{ t().currentPageLabel }}: {{ ellipsisPage() }} / 20
      </p>
    </section>
  `,
})
export class PaginationDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => PAGINATION_DEMO_LOCALES[this.localeId()] ?? PAGINATION_DEMO_LOCALES['en'],
  );

  readonly ellipsisPage = signal(10);
}
