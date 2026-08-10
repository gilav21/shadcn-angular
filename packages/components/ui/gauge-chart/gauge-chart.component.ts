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
    /** Value the needle fills to. Clamped to the {@link min}–{@link max} span for drawing, but reported unclamped in the readout and the accessible label. */
    readonly value = input.required<number>();
    /** Start of the scale, mapped to the left end of the arc. */
    readonly min = input(0);
    /** End of the scale, mapped to the right end of the arc. A span of zero or less renders an empty gauge rather than dividing by zero. */
    readonly max = input(100);
    /** Width of the SVG in pixels; the height is derived from it (a semicircle plus room for the readout). Rendered at this fixed size, so wrap it if you need it to scale with its container. */
    readonly size = input(220);
    /** Arc thickness as a fraction of the outer radius — `0.2` is a fifth of the radius, `1` a full pie wedge. Not a pixel value, so it scales with {@link size}. */
    readonly thickness = input(0.2);
    /**
     * Colour bands keyed by value. The arc takes the colour of the highest
     * threshold whose `value` the current {@link value} has reached; below the
     * lowest one it falls back to the first theme chart colour. Order does not
     * matter — the list is sorted internally.
     */
    readonly thresholds = input<GaugeThreshold[]>([]);
    /** Caption under the readout, describing what is being measured. Also folded into the gauge's accessible label. */
    readonly label = input('');
    /** Unit suffix appended to the displayed value and to the accessible label (e.g. `'%'`, `' GB'`). Purely cosmetic — it does not affect the scale. */
    readonly unit = input('');
    /** Shows the numeric readout in the middle of the arc. Turning it off leaves the gauge purely graphical; the value is still announced via the accessible label. */
    readonly showValue = input(true);
    /** Extra classes merged onto the `block` host — typically `text-*` for the readout, or margins. The SVG's own size comes from {@link size}. */
    readonly class = input('');
    /** Chart title, prefixed to the accessible label. Supply it when the gauge has no visible heading beside it. */
    readonly title = input<string | undefined>(undefined);
    /** Text direction for the labels: `'auto'` inherits from the document. The arc itself always sweeps left-to-right and does not mirror in RTL. */
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
