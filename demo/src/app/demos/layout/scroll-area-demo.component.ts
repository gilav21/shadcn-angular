import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ScrollAreaComponent,
  SeparatorComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-scroll-area-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollAreaComponent, SeparatorComponent],
  template: `
    <section class="space-y-4">
      <h2 id="scroll-area" class="text-2xl font-semibold scroll-m-20">Scroll Area</h2>
      <p class="text-muted-foreground">A custom scrollable area with styled scrollbars.</p>

      <ui-scroll-area class="h-72 w-48 rounded-md border">
        <div class="p-4">
          <h4 class="mb-4 text-sm font-medium leading-none">Tags</h4>
          @for (
          tag of tags;
          track tag
          ) {
          <div class="text-sm">{{ tag }}</div>
          <ui-separator class="my-2" />
          }
        </div>
      </ui-scroll-area>
    </section>
  `,
})
export class ScrollAreaDemoComponent {
  readonly tags = [
    'v1.2.0-beta.18',
    'v1.2.0-beta.17',
    'v1.2.0-beta.16',
    'v1.2.0-beta.15',
    'v1.2.0-beta.14',
    'v1.2.0-beta.13',
    'v1.2.0-beta.12',
    'v1.2.0-beta.11',
    'v1.2.0-beta.10',
    'v1.2.0-beta.9',
    'v1.2.0-beta.8',
    'v1.2.0-beta.7',
    'v1.2.0-beta.6',
    'v1.2.0-beta.5',
    'v1.2.0-beta.4',
    'v1.2.0-beta.3',
    'v1.2.0-beta.2',
  ];
}
