import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TreemapComponent, TreemapNode } from '@/components/ui/treemap';
import { ChartClickEvent } from '@/components/lib/chart.types';

/**
 * Harness for the `treemap` component — installed into a pristine consumer app
 * and driven by Playwright in `treemap.spec.ts`. The hierarchy is nested so the
 * group-border path is exercised, and the last clicked node is echoed into the
 * DOM so the click output can be asserted end to end.
 */
@Component({
    selector: 'app-treemap-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TreemapComponent],
    template: `
        <main class="p-8">
            <ui-treemap
                data-testid="root"
                [nodes]="nodes"
                [width]="560"
                [height]="340"
                unit=" MB"
                title="Demo treemap"
                (nodeClick)="onClick($event)"
            />
            <p data-testid="clicked">{{ clicked() }}</p>
        </main>
    `,
})
export class TreemapDemoComponent {
    readonly clicked = signal('none');

    readonly nodes: TreemapNode[] = [
        {
            label: 'Documents',
            children: [
                { label: 'Specs', value: 620 },
                { label: 'Guides', value: 380 },
                { label: 'Notes', value: 240 },
            ],
        },
        { label: 'Media', value: 860 },
        { label: 'Source', value: 540 },
    ];

    onClick(event: ChartClickEvent<TreemapNode>): void {
        this.clicked.set(event.point.label);
    }
}
