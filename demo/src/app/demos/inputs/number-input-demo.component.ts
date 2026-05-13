import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    NumberInputComponent,
    FieldComponent,
    FieldLabelComponent,
    FieldDescriptionComponent,
} from '../../../../../packages/components/ui';

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
                <h2 id="number-input" class="text-2xl font-semibold scroll-m-20">Number Input</h2>
                <p class="text-muted-foreground mt-1">Numeric input with increment/decrement controls.</p>
            </div>

            <!-- Default -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Default</h3>
                <ui-number-input
                    [(ngModel)]="defaultValue"
                    placeholder="Enter a number"
                />
                <p class="text-sm text-muted-foreground">Value: {{ defaultValue() ?? 'null' }}</p>
            </div>

            <!-- Min / Max / Step -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Min / Max / Step</h3>
                <p class="text-sm text-muted-foreground">Range 0–100, step 5</p>
                <ui-number-input
                    [(ngModel)]="rangeValue"
                    [min]="0"
                    [max]="100"
                    [step]="5"
                    placeholder="0–100"
                />
                <p class="text-sm text-muted-foreground">Value: {{ rangeValue() ?? 'null' }}</p>
            </div>

            <!-- Decimal step -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Decimal Step</h3>
                <p class="text-sm text-muted-foreground">Step 0.1, range 0–1</p>
                <ui-number-input
                    [(ngModel)]="decimalValue"
                    [min]="0"
                    [max]="1"
                    [step]="0.1"
                    placeholder="0.0"
                />
                <p class="text-sm text-muted-foreground">Value: {{ decimalValue() ?? 'null' }}</p>
            </div>

            <!-- Variants -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Variants</h3>
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

            <!-- Disabled -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Disabled</h3>
                <ui-number-input [value]="42" [disabled]="true" />
            </div>

            <!-- Inside ui-field -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Inside Field</h3>
                <ui-field>
                    <ui-field-label>Quantity</ui-field-label>
                    <ui-number-input
                        [(ngModel)]="fieldValue"
                        [min]="1"
                        [max]="999"
                        placeholder="1"
                    />
                    <ui-field-description>Enter the desired quantity (1–999).</ui-field-description>
                </ui-field>
                <p class="text-sm text-muted-foreground">Value: {{ fieldValue() ?? 'null' }}</p>
            </div>
        </section>
    `,
})
export class NumberInputDemoComponent {
    readonly defaultValue = signal<number | null>(null);
    readonly rangeValue = signal<number | null>(0);
    readonly decimalValue = signal<number | null>(0);
    readonly fieldValue = signal<number | null>(1);
}
