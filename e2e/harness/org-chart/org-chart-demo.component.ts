import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OrgChartComponent } from '@/components/ui/org-chart';
import type { OrgNode } from '@/components/lib/chart.types';

@Component({
    selector: 'app-org-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [OrgChartComponent],
    template: `
        <main class="w-[800px] p-8">
            <ui-org-chart data-testid="root" class="block" [data]="data" title="Team" />
        </main>
    `,
})
export class OrgChartDemoComponent {
    protected readonly data: OrgNode[] = [
        { id: 'ceo', name: 'Ada', title: 'CEO', parentId: null },
        { id: 'cto', name: 'Grace', title: 'CTO', parentId: 'ceo' },
        { id: 'eng', name: 'Linus', title: 'Engineer', parentId: 'cto' },
    ];
}
