import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NumberTickerComponent } from '@/components/ui/number-ticker';

/** Harness for the `number-ticker` component (`value` is a required input). */
@Component({
    selector: 'app-number-ticker-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NumberTickerComponent],
    template: `
        <main class="p-8">
            <ui-number-ticker data-testid="root" class="block" [value]="value()" />
            <button type="button" data-testid="bump" (click)="value.set(42)">Bump</button>
        </main>
    `,
})
export class NumberTickerDemoComponent {
    readonly value = signal(7);
}
