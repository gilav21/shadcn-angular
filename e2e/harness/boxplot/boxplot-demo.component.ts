import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BoxplotComponent, BoxplotGroup } from '@/components/ui/boxplot';

/**
 * Harness for the `boxplot` component — installed into a pristine consumer app
 * and driven by Playwright in `boxplot.spec.ts`. The `main` group carries one
 * sample beyond the 1.5×IQR fence so the outlier path is exercised too.
 */
@Component({
    selector: 'app-boxplot-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BoxplotComponent],
    template: `
        <main class="p-8">
            <ui-boxplot
                data-testid="root"
                [groups]="groups"
                [width]="520"
                [height]="320"
                unit="s"
                title="Demo box plot"
            />
        </main>
    `,
})
export class BoxplotDemoComponent {
    readonly groups: BoxplotGroup[] = [
        { label: 'main', values: [42, 44, 45, 46, 47, 48, 49, 51, 53, 92] },
        { label: 'feature', values: [50, 52, 55, 57, 58, 60, 61, 64, 70] },
        { label: 'release', stats: { min: 38, q1: 41, median: 43, q3: 45, max: 47, outliers: [] } },
    ];
}
