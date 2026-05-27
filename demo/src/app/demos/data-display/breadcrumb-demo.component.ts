import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  BreadcrumbLinkComponent,
  BreadcrumbListComponent,
  BreadcrumbPageComponent,
  BreadcrumbSeparatorComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { BREADCRUMB_DEMO_LOCALES } from './breadcrumb-demo.locales';

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
      <h2 id="breadcrumb" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-breadcrumb>
        <ui-breadcrumb-list>
          <ui-breadcrumb-item>
            <ui-breadcrumb-link href="javascript:void(0)">{{ t().crumbHome }}</ui-breadcrumb-link>
          </ui-breadcrumb-item>
          <ui-breadcrumb-separator />
          <ui-breadcrumb-item>
            <ui-breadcrumb-link href="javascript:void(0)">{{ t().crumbComponents }}</ui-breadcrumb-link>
          </ui-breadcrumb-item>
          <ui-breadcrumb-separator />
          <ui-breadcrumb-item>
            <ui-breadcrumb-page>{{ t().crumbBreadcrumb }}</ui-breadcrumb-page>
          </ui-breadcrumb-item>
        </ui-breadcrumb-list>
      </ui-breadcrumb>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDescription }}</p>
      <ui-breadcrumb>
        <ui-breadcrumb-list [items]="[
          { label: t().crumbHome, href: '/' },
          { label: t().crumbProducts, href: '/products' },
          { label: t().crumbLaptops, href: '/products/laptops' },
          { label: t().crumbMacBook, isCurrentPage: true }
        ]" />
      </ui-breadcrumb>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading2 }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDescription2 }}</p>
      <ui-breadcrumb>
        <ui-breadcrumb-list [items]="[
          { label: t().crumbHome, href: '/' },
          { label: t().crumbProducts, href: '/products' },
          { label: t().crumbElectronics, href: '/products/electronics' },
          { label: t().crumbLaptops }
        ]" />
      </ui-breadcrumb>
    </section>
  `,
})
export class BreadcrumbDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => BREADCRUMB_DEMO_LOCALES[this.localeId()] ?? BREADCRUMB_DEMO_LOCALES['en']);
}
