import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HistogramComponent } from '@/components/ui/histogram';

/**
 * Harness for the `histogram` component — installed into a pristine consumer
 * app and driven by Playwright in `histogram.spec.ts`.
 */
@Component({
    selector: 'app-histogram-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [HistogramComponent],
    template: `
        <main class="p-8">
            <ui-histogram
                data-testid="root"
                [values]="values"
                [binCount]="8"
                [width]="560"
                [height]="300"
                unit="ms"
                title="Demo histogram"
            />
        </main>
    `,
})
export class HistogramDemoComponent {
    readonly values: number[] = Array.from({ length: 100 }, (_, i) => i);
}
