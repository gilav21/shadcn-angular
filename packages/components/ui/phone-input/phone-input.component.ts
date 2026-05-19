import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    effect,
    forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../../lib/utils';
import { InputComponent } from '../input';
import { InputGroupComponent, InputGroupAddonComponent } from '../input-group.component';
import { PopoverComponent, PopoverTriggerComponent, PopoverContentComponent } from '../popover.component';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';
import { InputMaskDirective } from '../input-mask.directive';
import { PhoneCountry, DEFAULT_COUNTRIES } from './phone-input-data';

export type { PhoneCountry };

export type PhoneInputVariant = 'outline' | 'underline' | 'ghost';

/**
 * International phone number input built on `ui-input-group`.
 *
 * The country selector (flag + dial code) is a popover trigger; the inner
 * `ui-input` is wrapped by `InputMaskDirective` with the selected country's
 * mask, so the user physically cannot type characters that don't fit the
 * format. The component emits an E.164 string (`+15551234567`) via
 * `valueChange` and `ControlValueAccessor`.
 *
 * @example Basic usage with two-way binding
 * ```html
 * <ui-phone-input [(ngModel)]="phone" />
 * ```
 *
 * @example With a default country and reactive form
 * ```html
 * <ui-phone-input defaultCountry="GB" [formControl]="phoneCtrl" />
 * ```
 */

function buildE164(dialCode: string, masked: string): string {
    const digits = masked.replaceAll(/\D/g, '');
    return digits ? `${dialCode}${digits}` : '';
}

function findCountryByCode(countries: PhoneCountry[], code: string): PhoneCountry | undefined {
    return countries.find(c => c.code === code);
}

function findCountryByLongestDialCode(value: string, countries: PhoneCountry[]): PhoneCountry | undefined {
    let bestMatch: PhoneCountry | undefined;
    let bestLen = 0;
    for (const c of countries) {
        if (value.startsWith(c.dialCode) && c.dialCode.length > bestLen) {
            bestLen = c.dialCode.length;
            bestMatch = c;
        }
    }
    return bestMatch;
}

function parseE164(value: string, countries: PhoneCountry[], currentCountry: PhoneCountry): { country: PhoneCountry; national: string } {
    if (!value.startsWith('+')) {
        return { country: currentCountry, national: value };
    }
    const match = findCountryByLongestDialCode(value, countries);
    if (!match) return { country: currentCountry, national: value };
    if (match.dialCode === currentCountry.dialCode) {
        return { country: currentCountry, national: value.slice(currentCountry.dialCode.length) };
    }
    return { country: match, national: value.slice(match.dialCode.length) };
}

@Component({
    selector: 'ui-phone-input',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        InputComponent,
        InputGroupComponent,
        InputGroupAddonComponent,
        PopoverComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
        InputMaskDirective,
    ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => PhoneInputComponent),
            multi: true,
        },
        {
            provide: UI_INPUT_GROUP,
            useExisting: forwardRef(() => PhoneInputComponent),
        },
    ],
    templateUrl: './phone-input.component.html',
    host: { class: 'contents' },
})
export class PhoneInputComponent implements ControlValueAccessor {
    /** ISO 3166-1 alpha-2 code of the initially selected country. Defaults to `'US'`. */
    readonly defaultCountry = input<string>('US');
    /** Disables both the country selector and the number input. */
    readonly disabled = input<boolean>(false);
    /** Overrides the country's example placeholder. */
    readonly placeholder = input<string | undefined>(undefined);
    /** Extra CSS classes for the outer wrapper (the `ui-input-group`). */
    readonly class = input('');
    /** Visual style of the wrapping `ui-input-group`. */
    readonly variant = input<PhoneInputVariant>('outline');
    /** Country list shown in the dropdown. Defaults to {@link DEFAULT_COUNTRIES}. */
    readonly countries = input<PhoneCountry[]>(DEFAULT_COUNTRIES);
    /** External value (E.164 string). Use this for one-way binding without forms. */
    readonly value = input<string | null>(null);

    /** Emits the E.164-formatted phone number on every change (`''` when empty). */
    readonly valueChange = output<string>();

    private readonly _selectedCountry = signal<PhoneCountry>(DEFAULT_COUNTRIES[0]);
    readonly selectedCountry = this._selectedCountry.asReadonly();

    private readonly _nationalNumber = signal<string>('');
    readonly nationalNumber = this._nationalNumber.asReadonly();

    private readonly _formDisabled = signal(false);
    private readonly _userPickedCountry = signal(false);
    private readonly _searchQuery = signal('');
    readonly searchQuery = this._searchQuery.asReadonly();

    readonly isDisabled = computed(() => this.disabled() || this._formDisabled());

    readonly effectivePlaceholder = computed(
        () => this.placeholder() ?? this.selectedCountry().placeholder ?? this.selectedCountry().mask
    );

    readonly filteredCountries = computed(() => {
        const q = this._searchQuery().toLowerCase();
        if (!q) return this.countries();
        return this.countries().filter(
            c => c.name.toLowerCase().includes(q) || c.dialCode.includes(q)
        );
    });

    readonly triggerClasses = computed(() =>
        cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-l text-sm transition-colors',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50'
        )
    );

    private onChange: (value: string) => void = () => { };
    private onTouched: () => void = () => { };

    constructor() {
        effect(() => {
            if (this._userPickedCountry()) return;
            const code = this.defaultCountry();
            const found = findCountryByCode(this.countries(), code);
            this._selectedCountry.set(found ?? this.countries()[0]);
        });

        effect(() => {
            const val = this.value();
            if (val !== null) {
                this.applyExternalValue(val);
            }
        });
    }

    countryRowClasses(country: PhoneCountry): string {
        return cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
            'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
            country.code === this.selectedCountry().code && 'bg-accent/50'
        );
    }

    selectCountry(country: PhoneCountry): void {
        this._userPickedCountry.set(true);
        this._selectedCountry.set(country);
        this._searchQuery.set('');
        this._nationalNumber.set('');
        this.emitValue();
    }

    onSearchInput(event: Event): void {
        this._searchQuery.set((event.target as HTMLInputElement).value);
    }

    onNationalChange(raw: string): void {
        this._nationalNumber.set(raw);
        this.emitValue();
    }

    onBlur(): void {
        this.onTouched();
    }

    writeValue(value: string | null): void {
        this.applyExternalValue(value ?? '');
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this._formDisabled.set(isDisabled);
    }

    private applyExternalValue(value: string): void {
        if (!value) {
            this._nationalNumber.set('');
            return;
        }
        const { country, national } = parseE164(value, this.countries(), this._selectedCountry());
        this._selectedCountry.set(country);
        this._nationalNumber.set(national);
    }

    private emitValue(): void {
        const e164 = buildE164(this._selectedCountry().dialCode, this._nationalNumber());
        this.onChange(e164);
        this.valueChange.emit(e164);
    }
}
