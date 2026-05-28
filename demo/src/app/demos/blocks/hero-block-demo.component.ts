import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HeroBlockComponent } from '../../../../../packages/blocks/hero';

@Component({
  selector: 'app-hero-block-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroBlockComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h2 id="hero-block" class="text-2xl font-semibold scroll-m-20">Hero</h2>
        <p class="text-muted-foreground mt-1">
          A centered landing hero with an eyebrow badge, headline, subheading, and
          dual call-to-action buttons. Composed from <code>button</code> and <code>badge</code>.
        </p>
        <code class="mt-3 inline-block rounded bg-muted px-2 py-1 text-xs">npx shadcn-angular add hero</code>
      </div>

      <div class="rounded-lg border overflow-hidden bg-background">
        <div class="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span class="h-3 w-3 rounded-full bg-red-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-yellow-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-green-400/70"></span>
        </div>
        <div class="bg-muted/20">
          <ui-hero-block />
        </div>
      </div>
    </section>
  `,
})
export class HeroBlockDemoComponent {}
