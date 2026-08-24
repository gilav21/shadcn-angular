import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
    DurationInputComponent,
    FieldComponent,
    FieldDescriptionComponent,
    FieldLabelComponent,
} from '../../../../../packages/components/ui';
import { formatIso8601 } from '../../../../../packages/components/ui/duration-input';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { DURATION_INPUT_DEMO_LOCALES } from './duration-input-demo.locales';

@Component({
    selector: 'app-duration-input-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DurationInputComponent,
        FieldComponent,
        FieldLabelComponent,
        FieldDescriptionComponent,
    ],
    template: `
        <section class="max-w-2xl space-y-8">
            <div>
                <h2 id="duration-input" class="scroll-m-20 text-2xl font-semibold">{{ t().heading }}</h2>
                <p class="text-muted-foreground mt-1">{{ t().description }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().basicHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().basicDescription }}</p>
                <ui-duration-input [(value)]="basic" [units]="['hours', 'minutes']" />
                <p class="text-muted-foreground text-sm" data-testid="basic-value">
                    {{ t().secondsLabel }}: {{ basic() ?? t().emptyValue }}
                </p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().unitsHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().unitsDescription }}</p>
                <div class="flex flex-wrap gap-4">
                    <ui-duration-input [value]="5400" [units]="['hours', 'minutes']" ariaLabel="Hours and minutes" />
                    <ui-duration-input [value]="5400" [units]="['minutes', 'seconds']" ariaLabel="Minutes and seconds" />
                    <ui-duration-input [value]="5400" [units]="['seconds']" ariaLabel="Seconds only" />
                </div>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().isoHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().isoDescription }}</p>
                <ui-field>
                    <ui-field-label>{{ t().heading }}</ui-field-label>
                    <ui-duration-input
                        [(value)]="withSeconds"
                        [units]="['hours', 'minutes', 'seconds']"
                    />
                    <ui-field-description data-testid="iso-value">
                        {{ iso() ?? t().emptyValue }}
                    </ui-field-description>
                </ui-field>
            </div>
        </section>
    `,
})
export class DurationInputDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(
        () => DURATION_INPUT_DEMO_LOCALES[this.localeId()] ?? DURATION_INPUT_DEMO_LOCALES['en'],
    );

    protected readonly basic = signal<number | null>(5400);
    protected readonly withSeconds = signal<number | null>(5445);

    /** The serialisation form, derived rather than stored. */
    protected readonly iso = computed(() => formatIso8601(this.withSeconds()));
}
