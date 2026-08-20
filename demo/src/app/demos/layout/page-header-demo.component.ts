import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  BreadcrumbLinkComponent,
  BreadcrumbListComponent,
  BreadcrumbPageComponent,
  BreadcrumbSeparatorComponent,
  ButtonComponent,
  PageHeaderComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { PAGE_HEADER_DEMO_LOCALES } from './page-header-demo.locales';

@Component({
  selector: 'app-page-header-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    BreadcrumbComponent,
    BreadcrumbListComponent,
    BreadcrumbItemComponent,
    BreadcrumbLinkComponent,
    BreadcrumbPageComponent,
    BreadcrumbSeparatorComponent,
  ],
  template: `
    <section class="space-y-6">
      <h2 id="page-header" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="rounded-lg border p-4 sm:p-6">
        <ui-page-header [title]="t().pageTitle" [description]="t().pageDescription" [headingLevel]="2">
          <ui-breadcrumb>
            <ui-breadcrumb-list>
              <ui-breadcrumb-item>
                <ui-breadcrumb-link href="javascript:void(0)">{{ t().crumbBilling }}</ui-breadcrumb-link>
              </ui-breadcrumb-item>
              <ui-breadcrumb-separator />
              <ui-breadcrumb-item>
                <ui-breadcrumb-page>{{ t().crumbInvoices }}</ui-breadcrumb-page>
              </ui-breadcrumb-item>
            </ui-breadcrumb-list>
          </ui-breadcrumb>
          <ui-button variant="outline" [label]="t().export" />
          <ui-button [label]="t().newInvoice" />
        </ui-page-header>
      </div>

      <div class="space-y-2">
        <p class="text-sm text-muted-foreground">{{ t().narrowLabel }}</p>
        <div class="w-[320px] max-w-full rounded-lg border p-4">
          <ui-page-header [title]="t().pageTitle" [description]="t().pageDescription" [headingLevel]="2">
            <ui-button variant="outline" [label]="t().export" />
            <ui-button [label]="t().newInvoice" />
          </ui-page-header>
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-sm text-muted-foreground">{{ t().levelLabel }}</p>
        <div class="rounded-lg border p-4 sm:p-6">
          <ui-page-header [title]="t().teamTitle" [description]="t().teamDescription" [headingLevel]="2" />
        </div>
      </div>
    </section>
  `,
})
export class PageHeaderDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => PAGE_HEADER_DEMO_LOCALES[this.localeId()] ?? PAGE_HEADER_DEMO_LOCALES['en']
  );
}
