import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  BreadcrumbLinkComponent,
  BreadcrumbListComponent,
  BreadcrumbPageComponent,
  BreadcrumbSeparatorComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-breadcrumb-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BreadcrumbComponent,
    BreadcrumbListComponent,
    BreadcrumbItemComponent,
    BreadcrumbLinkComponent,
    BreadcrumbPageComponent,
    BreadcrumbSeparatorComponent,
  ],
  template: `
    <section class="space-y-4" id="breadcrumbSection">
      <h2 id="breadcrumb" class="text-2xl font-semibold scroll-m-20">Breadcrumb</h2>
      <p class="text-muted-foreground">Displays the path to the current page.</p>

      <ui-breadcrumb>
        <ui-breadcrumb-list>
          <ui-breadcrumb-item>
            <ui-breadcrumb-link href="javascript:void(0)">Home</ui-breadcrumb-link>
          </ui-breadcrumb-item>
          <ui-breadcrumb-separator />
          <ui-breadcrumb-item>
            <ui-breadcrumb-link href="javascript:void(0)">Components</ui-breadcrumb-link>
          </ui-breadcrumb-item>
          <ui-breadcrumb-separator />
          <ui-breadcrumb-item>
            <ui-breadcrumb-page>Breadcrumb</ui-breadcrumb-page>
          </ui-breadcrumb-item>
        </ui-breadcrumb-list>
      </ui-breadcrumb>

      <h3 class="text-lg font-medium mt-8">Simple Mode (Data-driven)</h3>
      <p class="text-muted-foreground text-sm mb-4">Auto-generated from items array with separators.</p>
      <ui-breadcrumb>
        <ui-breadcrumb-list [items]="[
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          { label: 'Laptops', href: '/products/laptops' },
          { label: 'MacBook Pro', isCurrentPage: true }
        ]" />
      </ui-breadcrumb>

      <h3 class="text-lg font-medium mt-8">Simple Mode (Data-driven)</h3>
      <p class="text-muted-foreground text-sm mb-4">Using the items input array on ui-breadcrumb-list.</p>
      <ui-breadcrumb>
        <ui-breadcrumb-list [items]="[
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          { label: 'Electronics', href: '/products/electronics' },
          { label: 'Laptops' }
        ]" />
      </ui-breadcrumb>
    </section>
  `,
})
export class BreadcrumbDemoComponent {}
