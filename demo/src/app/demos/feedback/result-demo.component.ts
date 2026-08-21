import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  ResultComponent,
  ResultDetailComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { RESULT_DEMO_LOCALES } from './result-demo.locales';

@Component({
  selector: 'app-result-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ResultComponent, ResultDetailComponent, ButtonComponent],
  template: `
    <section class="space-y-4">
      <h2 id="result" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <h3 class="text-lg font-medium mt-8">{{ t().statusesHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().statusesDescription }}</p>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ui-result
          status="success"
          [title]="t().successTitle"
          [description]="t().successDescription"
          class="rounded-lg border"
        />
        <ui-result
          status="error"
          [title]="t().errorTitle"
          [description]="t().errorDescription"
          class="rounded-lg border"
        />
        <ui-result
          status="warning"
          [title]="t().warningTitle"
          [description]="t().warningDescription"
          class="rounded-lg border"
        />
        <ui-result
          status="info"
          [title]="t().infoTitle"
          [description]="t().infoDescription"
          class="rounded-lg border"
        />
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().actionsHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().actionsDescription }}</p>
      <ui-result
        status="success"
        [title]="t().orderTitle"
        [description]="t().orderDescription"
        class="rounded-lg border"
      >
        <ui-button>{{ t().trackOrder }}</ui-button>
        <ui-button variant="outline">{{ t().viewInvoice }}</ui-button>
        <ui-button variant="ghost">{{ t().keepShopping }}</ui-button>
      </ui-result>

      <h3 class="text-lg font-medium mt-8">{{ t().detailHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().detailDescription }}</p>
      <ui-result
        status="error"
        [title]="t().importFailedTitle"
        [description]="t().importFailedDescription"
        class="rounded-lg border"
      >
        <ui-result-detail>
          <pre class="whitespace-pre">{{ trace }}</pre>
        </ui-result-detail>
        <ui-button>{{ t().tryAgain }}</ui-button>
        <ui-button variant="outline">{{ t().contactSupport }}</ui-button>
      </ui-result>

      <h3 class="text-lg font-medium mt-8">{{ t().noActionsHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().noActionsDescription }}</p>
      <ui-result
        status="info"
        [title]="t().nothingTitle"
        [description]="t().nothingDescription"
        class="rounded-lg border"
      />
    </section>
  `,
})
export class ResultDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(
    () => RESULT_DEMO_LOCALES[this.localeId()] ?? RESULT_DEMO_LOCALES['en'],
  );

  readonly trace = [
    "TypeError: Cannot read properties of undefined (reading 'sku')",
    '    at parseRow (import.ts:42:18)',
    '    at Array.map (<anonymous>)',
  ].join('\n');
}
