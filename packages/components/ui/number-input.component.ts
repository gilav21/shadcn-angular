import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    forwardRef,
    viewChild,
    ElementRef,
    effect,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cva } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { IconComponent } from './icon.component';

const numberInputWrapperVariants = cva(
    'relative flex items-center border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] aria-disabled:pointer-events-none aria-disabled:opacity-50',
    {
        variants: {
            variant: {
                outline: 'dark:bg-input/30 h-9 rounded-lg border',
                underline: 'rounded-none border-b border-t-0 border-x-0 focus-within:ring-0 shadow-none',
                ghost: 'border-none shadow-none focus-within:ring-0',
            },
        },
        defaultVariants: {
            variant: 'outline',
        },
    }
);

export type NumberInputVariant = 'outline' | 'underline' | 'ghost';

@Component({
    selector: 'ui-number-input',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IconComponent],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => NumberInputComponent),
            multi: true,
        },
    ],
    template: `
        <div
            [class]="wrapperClasses()"
            [attr.data-slot]="'number-input'"
            [attr.aria-disabled]="isDisabled() || null"
        >
            <input
                #inputRef
                type="text"
                inputmode="decimal"
                class="h-full w-full min-w-0 bg-transparent py-1 pl-3 pr-10 text-base outline-none placeholder:text-muted-foreground md:text-sm"
                [disabled]="isDisabled()"
                [placeholder]="placeholder()"
                [value]="displayValue()"
                (input)="onInputChange($event)"
                (blur)="onBlur()"
                (keydown)="onKeydown($event)"
                (wheel)="onWheel($event)"
            />
            <div class="absolute right-0 flex h-full flex-col border-l border-input">
                <button
                    type="button"
                    class="flex flex-1 items-center justify-center px-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-tr-lg transition-colors disabled:pointer-events-none disabled:opacity-50"
                    [disabled]="isDisabled()"
                    [attr.aria-label]="'Increment'"
                    (click)="increment()"
                >
                    <ui-icon name="chevron-up" size="xs" />
                </button>
                <button
                    type="button"
                    class="flex flex-1 items-center justify-center px-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-br-lg transition-colors disabled:pointer-events-none disabled:opacity-50 border-t border-input"
                    [disabled]="isDisabled()"
                    [attr.aria-label]="'Decrement'"
                    (click)="decrement()"
                >
                    <ui-icon name="chevron-down" size="xs" />
                </button>
            </div>
        </div>
    `,
    host: { class: 'contents' },
})
export class NumberInputComponent implements ControlValueAccessor {
    readonly value = input<number | null>(null);
    readonly min = input<number | undefined>(undefined);
    readonly max = input<number | undefined>(undefined);
    readonly step = input<number>(1);
    readonly disabled = input<boolean>(false);
    readonly placeholder = input<string>('0');
    readonly class = input('');
    readonly variant = input<NumberInputVariant>('outline');

    readonly valueChange = output<number | null>();

    readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputRef');

    private readonly _currentValue = signal<number | null>(null);
    private readonly _formDisabled = signal(false);

    readonly isDisabled = computed(() => this.disabled() || this._formDisabled());

    readonly displayValue = computed(() => {
        const v = this._currentValue();
        return v === null ? '' : String(v);
    });

    readonly wrapperClasses = computed(() =>
        cn(numberInputWrapperVariants({ variant: this.variant() }), this.class())
    );

    private onChange: (value: number | null) => void = () => { };
    private onTouched: () => void = () => { };

    constructor() {
        effect(() => {
            this._currentValue.set(this.value());
        });
    }

    onInputChange(event: Event): void {
        const raw = (event.target as HTMLInputElement).value;
        const parsed = this.parseValue(raw);
        this._currentValue.set(parsed);
        this.onChange(parsed);
        this.valueChange.emit(parsed);
    }

    onBlur(): void {
        const clamped = this.clamp(this._currentValue());
        if (clamped !== this._currentValue()) {
            this._currentValue.set(clamped);
            this.onChange(clamped);
            this.valueChange.emit(clamped);
        }
        this.onTouched();
    }

    onKeydown(event: KeyboardEvent): void {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.increment();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.decrement();
        }
    }

    onWheel(event: WheelEvent): void {
        const inputEl = this.inputRef().nativeElement;
        if (document.activeElement === inputEl) {
            event.preventDefault();
        }
    }

    increment(): void {
        const current = this._currentValue() ?? 0;
        const next = this.clamp(this.roundStep(current + this.step()));
        this.updateValue(next);
    }

    decrement(): void {
        const current = this._currentValue() ?? 0;
        const next = this.clamp(this.roundStep(current - this.step()));
        this.updateValue(next);
    }

    writeValue(value: number | null): void {
        this._currentValue.set(value ?? null);
    }

    registerOnChange(fn: (value: number | null) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this._formDisabled.set(isDisabled);
    }

    focus(): void {
        this.inputRef().nativeElement.focus();
    }

    private parseValue(raw: string): number | null {
        if (raw.trim() === '') return null;
        const parsed = Number.parseFloat(raw);
        return Number.isNaN(parsed) ? null : parsed;
    }

    private clamp(value: number | null): number | null {
        if (value === null) return null;
        const minVal = this.min();
        const maxVal = this.max();
        let result = value;
        if (minVal !== undefined) result = Math.max(result, minVal);
        if (maxVal !== undefined) result = Math.min(result, maxVal);
        return result;
    }

    private roundStep(value: number): number {
        const step = this.step();
        const decimals = (step.toString().split('.')[1] ?? '').length;
        return Number.parseFloat(value.toFixed(decimals));
    }

    private updateValue(value: number | null): void {
        this._currentValue.set(value);
        this.onChange(value);
        this.valueChange.emit(value);
    }
}
