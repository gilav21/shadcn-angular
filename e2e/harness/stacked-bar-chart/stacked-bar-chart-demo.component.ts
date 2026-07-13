import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StackedBarChartComponent } from '@/components/ui/stacked-bar-chart';
import type { ChartSeries } from '@/components/lib/chart.types';

@Component({
    selector: 'app-stacked-bar-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [StackedBarChartComponent],
    template: `
        <main class="w-[600px] p-8">
            <ui-stacked-bar-chart
                data-testid="root"
                class="block"
                [series]="series"
                [categories]="categories"
                title="Revenue"
            />
        </main>
    `,
})
export class StackedBarChartDemoComponent {
    protected readonly categories = ['Q1', 'Q2', 'Q3'];

    protected readonly series: ChartSeries[] = [
        {
            name: 'Direct',
            data: [
                { name: 'Q1', value: 30 },
                { name: 'Q2', value: 40 },
                { name: 'Q3', value: 20 },
            ],
        },
        {
            name: 'Partner',
            data: [
                { name: 'Q1', value: 10 },
                { name: 'Q2', value: 25 },
                { name: 'Q3', value: 35 },
            ],
        },
    ];
}
