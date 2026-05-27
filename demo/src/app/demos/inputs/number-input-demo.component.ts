import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    NumberInputComponent,
    FieldComponent,
    FieldLabelComponent,
    FieldDescriptionComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { NUMBER_INPUT_DEMO_LOCALES } from './number-input-demo.locales';

@Component({
    selector: 'app-number-input-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        NumberInputComponent,
        FieldComponent,
        FieldLabelComponent,
        FieldDescriptionComponent,
    ],
    template: `
        <section class="space-y-8 max-w-md">
            <div>
                <h2 id="number-input" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
                <p class="text-muted-foreground mt-1">{{ t().description }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().defaultHeading }}</h3>
                <ui-number-input
                    [(ngModel)]="defaultValue"
                    [placeholder]="t().defaultPlaceholder"
                />
                <p class="text-sm text-muted-foreground">Value: {{ defaultValue() ?? 'null' }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().minMaxHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().minMaxDescription }}</p>
                <ui-number-input
                    [(ngModel)]="rangeValue"
                    [min]="0"
                    [max]="100"
                    [step]="5"
                    placeholder="0–100"
                />
                <p class="text-sm text-muted-foreground">Value: {{ rangeValue() ?? 'null' }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().decimalHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().decimalDescription }}</p>
                <ui-number-input
                    [(ngModel)]="decimalValue"
                    [min]="0"
                    [max]="1"
                    [step]="0.1"
                    placeholder="0.0"
                />
                <p class="text-sm text-muted-foreground">Value: {{ decimalValue() ?? 'null' }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().variantsHeading }}</h3>
                <div class="space-y-3">
                    <div class="space-y-1">
                        <p class="text-xs text-muted-foreground">outline (default)</p>
                        <ui-number-input [value]="10" variant="outline" />
                    </div>
                    <div class="space-y-1">
                        <p class="text-xs text-muted-foreground">underline</p>
                        <ui-number-input [value]="10" variant="underline" />
                    </div>
                    <div class="space-y-1">
                        <p class="text-xs text-muted-foreground">ghost</p>
                        <ui-number-input [value]="10" variant="ghost" />
                    </div>
                </div>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().disabledHeading }}</h3>
                <ui-number-input [value]="42" [disabled]="true" />
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().insideFieldHeading }}</h3>
                <ui-field>
                    <ui-field-label>{{ t().quantityLabel }}</ui-field-label>
                    <ui-number-input
                        [(ngModel)]="fieldValue"
                        [min]="1"
                        [max]="999"
                        placeholder="1"
                    />
                    <ui-field-description>{{ t().quantityDescription }}</ui-field-description>
                </ui-field>
                <p class="text-sm text-muted-foreground">Value: {{ fieldValue() ?? 'null' }}</p>
            </div>
        </section>
    `,
})
export class NumberInputDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(() => NUMBER_INPUT_DEMO_LOCALES[this.localeId()] ?? NUMBER_INPUT_DEMO_LOCALES['en']);

    readonly defaultValue = signal<number | null>(null);
    readonly rangeValue = signal<number | null>(0);
    readonly decimalValue = signal<number | null>(0);
    readonly fieldValue = signal<number | null>(1);
}
