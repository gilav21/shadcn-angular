import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FaqBlockComponent } from '../../../../../packages/blocks/faq';

@Component({
  selector: 'app-faq-block-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaqBlockComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h2 id="faq-block" class="text-2xl font-semibold scroll-m-20">FAQ</h2>
        <p class="text-muted-foreground mt-1">
          A frequently-asked-questions section built on an accordion with expandable
          answers. Composed from <code>accordion</code>.
        </p>
        <code class="mt-3 inline-block rounded bg-muted px-2 py-1 text-xs">npx shadcn-angular add faq</code>
      </div>

      <div class="rounded-lg border overflow-hidden bg-background">
        <div class="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span class="h-3 w-3 rounded-full bg-red-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-yellow-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-green-400/70"></span>
        </div>
        <div class="bg-muted/20 p-4 sm:p-8">
          <ui-faq-block />
        </div>
      </div>
    </section>
  `,
})
export class FaqBlockDemoComponent {}
