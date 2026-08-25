import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
    CurrencyInputComponent,
    FieldComponent,
    FieldDescriptionComponent,
    FieldLabelComponent,
} from '../../../../../packages/components/ui';
import { toMinorUnits } from '../../../../../packages/components/ui/currency-input';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CURRENCY_INPUT_DEMO_LOCALES } from './currency-input-demo.locales';

@Component({
    selector: 'app-currency-input-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        CurrencyInputComponent,
        FieldComponent,
        FieldLabelComponent,
        FieldDescriptionComponent,
    ],
    template: `
        <section class="max-w-2xl space-y-8">
            <div>
                <h2 id="currency-input" class="scroll-m-20 text-2xl font-semibold">{{ t().heading }}</h2>
                <p class="text-muted-foreground mt-1">{{ t().description }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().basicHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().basicDescription }}</p>
                <ui-currency-input
                    class="w-56"
                    [(value)]="basic"
                    [ariaLabel]="t().amountLabel"
                />
                <p class="text-muted-foreground text-sm" data-testid="basic-value">
                    {{ t().valueLabel }}: {{ basic() ?? t().emptyValue }}
                </p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().localesHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().localesDescription }}</p>
                <div class="grid gap-3 sm:grid-cols-2">
                    <ui-currency-input [value]="1234.5" currency="USD" locale="en-US" ariaLabel="US dollars" />
                    <ui-currency-input [value]="1234.5" currency="EUR" locale="de-DE" ariaLabel="Euro, German" />
                    <ui-currency-input [value]="1234.5" currency="EUR" locale="fr-FR" ariaLabel="Euro, French" />
                    <ui-currency-input [value]="1234.5" currency="EGP" locale="ar-EG" ariaLabel="Egyptian pounds" />
                </div>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().precisionHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().precisionDescription }}</p>
                <div class="grid gap-3 sm:grid-cols-3">
                    <ui-currency-input [value]="1234.56" currency="USD" locale="en-US" ariaLabel="Dollars" />
                    <ui-currency-input [value]="1235" currency="JPY" locale="ja-JP" ariaLabel="Yen" />
                    <ui-currency-input [value]="1.235" currency="KWD" locale="en-US" ariaLabel="Dinar" />
                </div>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().boundsHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().boundsDescription }}</p>
                <ui-currency-input
                    class="w-56"
                    [(value)]="bounded"
                    [min]="0"
                    [max]="100"
                    [ariaLabel]="t().amountLabel"
                />
                <p class="text-muted-foreground text-sm" data-testid="bounded-value">
                    {{ t().valueLabel }}: {{ bounded() ?? t().emptyValue }}
                </p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().formHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().formDescription }}</p>
                <ui-field>
                    <ui-field-label for="invoice-total">{{ t().amountLabel }}</ui-field-label>
                    <ui-currency-input
                        class="w-56"
                        [formControl]="total"
                        currency="GBP"
                        locale="en-GB"
                        [ariaLabel]="t().amountLabel"
                    />
                    <ui-field-description>
                        {{ t().minorLabel }}: {{ minorUnits() ?? t().emptyValue }} ·
                        {{ t().touchedLabel }}: {{ total.touched }}
                    </ui-field-description>
                </ui-field>
            </div>
        </section>
    `,
})
export class CurrencyInputDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(
        () => CURRENCY_INPUT_DEMO_LOCALES[this.localeId()] ?? CURRENCY_INPUT_DEMO_LOCALES['en'],
    );

    protected readonly basic = signal<number | null>(1234.5);
    protected readonly bounded = signal<number | null>(42);
    protected readonly total = new FormControl<number | null>(19.99);

    /**
     * The integer form, for the consumers who want it.
     *
     * The value itself is major units — `19.99`, not `1999` — because a
     * consumer binding to a field their API calls `price` expects the former.
     * Rounding to the currency's own scale on blur is what keeps the float
     * from drifting anywhere visible.
     */
    protected readonly minorUnits = computed(() => {
        const amount = this.total.value ?? null;
        return amount === null ? null : toMinorUnits(amount, 'en-GB', 'GBP');
    });
}
