import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ChartBrushComponent } from '@/components/ui/chart-brush';

/**
 * Auto-generated harness for the `chart-brush` component.
 * Extend the template and assertions in `chart-brush.spec.ts` as needed.
 */
@Component({
    selector: 'app-chart-brush-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ChartBrushComponent],
    template: `
        <main class="p-8">
            <ui-chart-brush data-testid="root"></ui-chart-brush>
        </main>
    `,
})
export class ChartBrushDemoComponent {}
