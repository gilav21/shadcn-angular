import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CurrencyInputComponent } from '@/components/ui/currency-input';

/**
 * Harness for `currency-input` in a pristine consumer app.
 *
 * The point of this suite is what unit tests cannot see: that the component
 * compiles and formats correctly when installed the way a consumer installs
 * it, with no workspace dedup and no shared `Intl` state. The locale row is
 * the interesting part — it is the one that depends on the runtime's ICU
 * data rather than on our code.
 */
@Component({
    selector: 'app-currency-input-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CurrencyInputComponent],
    template: `
        <main class="space-y-6 p-8">
            <ui-currency-input
                data-testid="root"
                class="w-56"
                [(value)]="amount"
                currency="USD"
                locale="en-US"
                ariaLabel="Amount"
            />
            <p data-testid="value">{{ amount() ?? 'null' }}</p>

            <ui-currency-input
                data-testid="german"
                class="w-56"
                [value]="1234.5"
                currency="EUR"
                locale="de-DE"
                ariaLabel="Euro"
            />

            <ui-currency-input
                data-testid="yen"
                class="w-56"
                [value]="1235"
                currency="JPY"
                locale="ja-JP"
                ariaLabel="Yen"
            />

            <ui-currency-input
                data-testid="bounded"
                class="w-56"
                [(value)]="bounded"
                [min]="0"
                [max]="100"
                ariaLabel="Bounded amount"
            />
            <p data-testid="bounded-value">{{ bounded() ?? 'null' }}</p>
        </main>
    `,
})
export class CurrencyInputDemoComponent {
    readonly amount = signal<number | null>(1234.5);
    readonly bounded = signal<number | null>(42);
}
