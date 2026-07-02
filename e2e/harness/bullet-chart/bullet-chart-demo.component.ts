import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BulletChartComponent } from '@/components/ui/bullet-chart';

@Component({
    selector: 'app-bullet-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BulletChartComponent],
    template: `
        <main class="p-8">
            <ui-bullet-chart
                data-testid="root"
                [value]="70"
                [target]="80"
                [ranges]="[50, 75, 100]"
                [width]="360"
                [height]="44"
                label="Revenue"
            />
        </main>
    `,
})
export class BulletChartDemoComponent {}
