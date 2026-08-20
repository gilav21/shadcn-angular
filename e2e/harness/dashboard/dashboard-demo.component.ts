import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardBlockComponent } from '@/blocks/dashboard';

/** Harness for the `dashboard` block. */
@Component({
    selector: 'app-dashboard-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DashboardBlockComponent],
    template: `
        <main class="p-8">
            <ui-dashboard-block data-testid="root" />
        </main>
    `,
})
export class DashboardDemoComponent {}
