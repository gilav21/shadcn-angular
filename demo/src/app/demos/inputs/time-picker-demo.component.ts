import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
    FieldComponent,
    FieldDescriptionComponent,
    FieldLabelComponent,
    TimePickerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TIME_PICKER_DEMO_LOCALES } from './time-picker-demo.locales';

@Component({
    selector: 'app-time-picker-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        TimePickerComponent,
        FieldComponent,
        FieldLabelComponent,
        FieldDescriptionComponent,
    ],
    template: `
        <section class="max-w-2xl space-y-8">
            <div>
                <h2 id="time-picker" class="scroll-m-20 text-2xl font-semibold">{{ t().heading }}</h2>
                <p class="text-muted-foreground mt-1">{{ t().description }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().basicHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().basicDescription }}</p>
                <ui-time-picker [(value)]="basic" [ariaLabel]="t().timeLabel" />
                <p class="text-muted-foreground text-sm" data-testid="basic-value">
                    {{ t().valueLabel }}: {{ basic() ?? t().emptyValue }}
                </p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().localesHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().localesDescription }}</p>
                <div class="grid gap-3 sm:grid-cols-2">
                    <ui-time-picker value="21:05" locale="en-US" ariaLabel="US English" />
                    <ui-time-picker value="21:05" locale="de-DE" ariaLabel="German" />
                    <ui-time-picker value="21:05" locale="ar-EG" ariaLabel="Egyptian Arabic" />
                    <ui-time-picker value="21:05" locale="zh-TW" ariaLabel="Traditional Chinese" />
                </div>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().secondsHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().secondsDescription }}</p>
                <ui-time-picker
                    [(value)]="precise"
                    [withSeconds]="true"
                    locale="en-GB"
                    [ariaLabel]="t().timeLabel"
                />
                <p class="text-muted-foreground text-sm" data-testid="seconds-value">
                    {{ t().valueLabel }}: {{ precise() ?? t().emptyValue }}
                </p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().formHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().formDescription }}</p>
                <ui-field>
                    <ui-field-label for="meeting-time">{{ t().timeLabel }}</ui-field-label>
                    <ui-time-picker [formControl]="meeting" [ariaLabel]="t().timeLabel" />
                    <ui-field-description>
                        {{ t().valueLabel }}: {{ meeting.value ?? t().emptyValue }} ·
                        {{ t().touchedLabel }}: {{ meeting.touched }}
                    </ui-field-description>
                </ui-field>
            </div>
        </section>
    `,
})
export class TimePickerDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(
        () => TIME_PICKER_DEMO_LOCALES[this.localeId()] ?? TIME_PICKER_DEMO_LOCALES['en'],
    );

    protected readonly basic = signal<string | null>('09:05');
    protected readonly precise = signal<string | null>('09:05:09');
    protected readonly meeting = new FormControl<string | null>(null);
}
