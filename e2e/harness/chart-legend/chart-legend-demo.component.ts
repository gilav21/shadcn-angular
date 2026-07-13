import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ChartLegendComponent, type ChartLegendItem } from '@/components/ui/chart-legend';

/** Harness for the `chart-legend` component. */
@Component({
    selector: 'app-chart-legend-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ChartLegendComponent],
    template: `
        <main class="w-[600px] p-8">
            <ui-chart-legend
                data-testid="root"
                class="block"
                [items]="items"
                [hidden]="hiddenKeys()"
                (itemToggle)="toggle($event)"
            />
            <p data-testid="hidden">{{ hiddenKeys().join(',') }}</p>
        </main>
    `,
})
export class ChartLegendDemoComponent {
    readonly items: ChartLegendItem[] = [
        { key: 'a', label: 'Series A', color: '#ff6b6b' },
        { key: 'b', label: 'Series B', color: '#4ecdc4' },
    ];

    readonly hiddenKeys = signal<string[]>([]);

    toggle(key: string): void {
        this.hiddenKeys.update(keys =>
            keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key],
        );
    }
}
