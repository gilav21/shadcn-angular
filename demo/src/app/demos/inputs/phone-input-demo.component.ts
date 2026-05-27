import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { PhoneInputComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { PHONE_INPUT_DEMO_LOCALES } from './phone-input-demo.locales';

@Component({
    selector: 'app-phone-input-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ReactiveFormsModule, PhoneInputComponent],
    template: `
        <section class="space-y-8 max-w-md">
            <div>
                <h2 id="phone-input" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
                <p class="text-muted-foreground mt-1">{{ t().description }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().basicHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().basicDescription }}</p>
                <ui-phone-input [(ngModel)]="lightValue" />
                <p class="text-sm text-muted-foreground">{{ t().e164Label }} {{ lightValue() || t().emptyValue }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().defaultCountryHeading }}</h3>
                <ui-phone-input defaultCountry="GB" [(ngModel)]="gbValue" />
                <p class="text-sm text-muted-foreground">{{ t().e164Label }} {{ gbValue() || t().emptyValue }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().disabledHeading }}</h3>
                <ui-phone-input [disabled]="true" [value]="'+15551234567'" />
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().variantsHeading }}</h3>
                <div class="space-y-3">
                    <div class="space-y-1">
                        <p class="text-xs text-muted-foreground">outline (default)</p>
                        <ui-phone-input variant="outline" />
                    </div>
                    <div class="space-y-1">
                        <p class="text-xs text-muted-foreground">underline</p>
                        <ui-phone-input variant="underline" />
                    </div>
                    <div class="space-y-1">
                        <p class="text-xs text-muted-foreground">ghost</p>
                        <ui-phone-input variant="ghost" />
                    </div>
                </div>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().reactiveFormHeading }}</h3>
                <ui-phone-input [formControl]="phoneControl" />
                <p class="text-sm text-muted-foreground">
                    {{ t().statusLabel }} {{ phoneControl.status }} | {{ t().e164Label }} {{ phoneControl.value || t().emptyValue }}
                </p>
            </div>
        </section>
    `,
})
export class PhoneInputDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(() => PHONE_INPUT_DEMO_LOCALES[this.localeId()] ?? PHONE_INPUT_DEMO_LOCALES['en']);

    readonly lightValue = signal('');
    readonly gbValue = signal('');
    readonly phoneControl = new FormControl('');
}
