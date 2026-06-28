import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { ChartDirection, GaugeThreshold } from '../../lib/chart.types';
import { describeArc, formatChartValue, getChartColor } from '../../lib/chart.utils';

const START_ANGLE = Math.PI; // left
const SWEEP = Math.PI;       // semicircle over the top

@Component({
    selector: 'ui-gauge-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './gauge-chart.component.html',
    host: {
        class: 'block',
    },
})
export class GaugeChartComponent {
    readonly value = input.required<number>();
    readonly min = input(0);
    readonly max = input(100);
    readonly size = input(220);
    readonly thickness = input(0.2);
    readonly thresholds = input<GaugeThreshold[]>([]);
    readonly label = input('');
    readonly unit = input('');
    readonly showValue = input(true);
    readonly class = input('');
    readonly title = input<string | undefined>(undefined);
    readonly dir = input<ChartDirection>('auto');

    readonly classes = computed(() => cn('block', this.class()));

    readonly ratio = computed(() => {
        const span = this.max() - this.min();
        if (span <= 0) return 0;
        return Math.max(0, Math.min(1, (this.value() - this.min()) / span));
    });

    readonly center = computed(() => this.size() / 2);
    readonly outerRadius = computed(() => this.size() / 2 - 8);
    readonly innerRadius = computed(() => this.outerRadius() * (1 - this.thickness()));
    readonly viewBoxHeight = computed(() => this.size() / 2 + 36);
    readonly viewBox = computed(() => `0 0 ${this.size()} ${this.viewBoxHeight()}`);

    readonly trackPath = computed(() =>
        describeArc(this.center(), this.center(), this.outerRadius(), this.innerRadius(), START_ANGLE, START_ANGLE + SWEEP),
    );

    readonly valuePath = computed(() => {
        const r = this.ratio();
        if (r <= 0) return '';
        return describeArc(this.center(), this.center(), this.outerRadius(), this.innerRadius(), START_ANGLE, START_ANGLE + SWEEP * r);
    });

    readonly activeColor = computed(() => {
        const thresholds = [...this.thresholds()].sort((a, b) => a.value - b.value);
        let color = getChartColor(0);
        for (const t of thresholds) {
            if (this.value() >= t.value) color = t.color;
        }
        return color;
    });

    readonly displayValue = computed(() => `${formatChartValue(this.value())}${this.unit()}`);

    readonly ariaLabel = computed(() => {
        const base = this.title() ? `${this.title()}. ` : '';
        const lbl = this.label() ? `${this.label()}: ` : '';
        return `${base}Gauge. ${lbl}${this.displayValue()} of ${formatChartValue(this.max())}${this.unit()}.`;
    });
}
