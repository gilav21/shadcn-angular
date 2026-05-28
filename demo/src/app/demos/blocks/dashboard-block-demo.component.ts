import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardBlockComponent } from '../../../../../packages/blocks/dashboard';

@Component({
  selector: 'app-dashboard-block-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DashboardBlockComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h2 id="dashboard-block" class="text-2xl font-semibold scroll-m-20">Dashboard</h2>
        <p class="text-muted-foreground mt-1">
          An analytics overview page with stat cards, a bar chart, and a recent-activity
          table. Composed from <code>card</code>, <code>bar-chart</code>,
          <code>table</code>, <code>avatar</code> and <code>badge</code>.
        </p>
        <code class="mt-3 inline-block rounded bg-muted px-2 py-1 text-xs">npx shadcn-angular add dashboard</code>
      </div>

      <div class="rounded-lg border overflow-hidden bg-background">
        <div class="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span class="h-3 w-3 rounded-full bg-red-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-yellow-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-green-400/70"></span>
        </div>
        <div class="bg-muted/20 p-4 sm:p-6">
          <ui-dashboard-block />
        </div>
      </div>
    </section>
  `,
})
export class DashboardBlockDemoComponent {}
