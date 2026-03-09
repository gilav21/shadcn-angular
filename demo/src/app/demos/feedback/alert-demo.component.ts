import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  AlertComponent,
  AlertDescriptionComponent,
  AlertTitleComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-alert-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, AlertTitleComponent, AlertDescriptionComponent],
  template: `
    <section class="space-y-4">
      <h2 id="alert" class="text-2xl font-semibold scroll-m-20">Alert</h2>
      <p class="text-muted-foreground">Displays a callout for user attention.</p>

      <div class="space-y-4">
        <ui-alert>
          <ui-alert-title>Heads up!</ui-alert-title>
          <ui-alert-description>
            You can add components to your app using the cli.
          </ui-alert-description>
        </ui-alert>

        <ui-alert variant="destructive">
          <ui-alert-title>Error</ui-alert-title>
          <ui-alert-description>
            Your session has expired. Please log in again.
          </ui-alert-description>
        </ui-alert>
      </div>

      <h3 class="text-lg font-medium mt-8">Simple Mode (Data-driven)</h3>
      <p class="text-muted-foreground text-sm mb-4">Using title and description inputs.</p>
      <div class="space-y-4">
        <ui-alert title="Note" description="This is a simple alert using inputs." />
        <ui-alert variant="destructive" title="Critical Error"
          description="Something went wrong, and this alert was created with just two inputs." />
      </div>
    </section>
  `,
})
export class AlertDemoComponent {}
