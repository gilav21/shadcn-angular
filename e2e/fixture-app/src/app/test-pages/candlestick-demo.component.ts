import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CandlestickComponent, OhlcPoint } from '@/components/ui/candlestick';

/**
 * Harness for the `candlestick` component — installed into a pristine consumer
 * app and driven by Playwright in `candlestick.spec.ts`. The series skips a
 * weekend, which the default ordinal axis must close up.
 */
@Component({
    selector: 'app-candlestick-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CandlestickComponent],
    template: `
        <main class="p-8">
            <ui-candlestick
                data-testid="root"
                [points]="points"
                [width]="560"
                [height]="320"
                unit="$"
                title="Demo candlestick"
            />
        </main>
    `,
})
export class CandlestickDemoComponent {
    readonly points: OhlcPoint[] = [
        { date: '2026-01-05', open: 100, high: 106, low: 99, close: 104 },
        { date: '2026-01-06', open: 104, high: 108, low: 103, close: 105 },
        { date: '2026-01-07', open: 105, high: 106, low: 98, close: 99 },
        { date: '2026-01-08', open: 99, high: 103, low: 97, close: 102 },
        { date: '2026-01-09', open: 102, high: 110, low: 101, close: 109 },
        { date: '2026-01-12', open: 109, high: 112, low: 106, close: 107 },
    ];
}
