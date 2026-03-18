import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ButtonComponent,
  EmptyComponent,
  EmptyContentComponent,
  EmptyDescriptionComponent,
  EmptyHeaderComponent,
  EmptyMediaComponent,
  EmptyTitleComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-empty-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyComponent,
    EmptyHeaderComponent,
    EmptyMediaComponent,
    EmptyTitleComponent,
    EmptyDescriptionComponent,
    EmptyContentComponent,
    ButtonComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="empty" class="text-2xl font-semibold scroll-m-20">Empty</h2>
      <p class="text-muted-foreground">A unified empty state component for lists, tables, and other data displays.
      </p>

      <div class="border rounded-lg p-8 max-w-md">
        <ui-empty>
          <ui-empty-header>
            <ui-empty-media>
              <span class="text-4xl">&#x1f4ed;</span>
            </ui-empty-media>
            <ui-empty-title>No messages</ui-empty-title>
            <ui-empty-description>
              You haven't received any messages yet.
            </ui-empty-description>
          </ui-empty-header>
          <ui-empty-content>
            <ui-button>Send Message</ui-button>
          </ui-empty-content>
        </ui-empty>
      </div>
    </section>
  `,
})
export class EmptyDemoComponent {}
