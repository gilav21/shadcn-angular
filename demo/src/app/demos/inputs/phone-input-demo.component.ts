import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { PhoneInputComponent } from '../../../../../packages/components/ui';

@Component({
    selector: 'app-phone-input-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ReactiveFormsModule, PhoneInputComponent],
    template: `
        <section class="space-y-8 max-w-md">
            <div>
                <h2 id="phone-input" class="text-2xl font-semibold scroll-m-20">Phone Input</h2>
                <p class="text-muted-foreground mt-1">
                    International phone input built on <code>ui-input-group</code>. Pick a country to set the
                    dial code, then type the local number. The field is masked per country — invalid
                    characters cannot be entered, and separators are inserted automatically.
                </p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">Basic usage</h3>
                <p class="text-sm text-muted-foreground">
                    Try typing letters — they're rejected. Switch the country and watch the mask change.
                </p>
                <ui-phone-input [(ngModel)]="lightValue" />
                <p class="text-sm text-muted-foreground">E.164 value: {{ lightValue() || '(empty)' }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">Default country</h3>
                <ui-phone-input defaultCountry="GB" [(ngModel)]="gbValue" />
                <p class="text-sm text-muted-foreground">E.164 value: {{ gbValue() || '(empty)' }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">Disabled</h3>
                <ui-phone-input [disabled]="true" [value]="'+15551234567'" />
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">Variants</h3>
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
                <h3 class="text-lg font-medium">Reactive form</h3>
                <ui-phone-input [formControl]="phoneControl" />
                <p class="text-sm text-muted-foreground">
                    Status: {{ phoneControl.status }} | Value: {{ phoneControl.value || '(empty)' }}
                </p>
            </div>
        </section>
    `,
})
export class PhoneInputDemoComponent {
    readonly lightValue = signal('');
    readonly gbValue = signal('');
    readonly phoneControl = new FormControl('');
}
