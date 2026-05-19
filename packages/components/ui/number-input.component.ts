import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    forwardRef,
    viewChild,
    effect,
    DestroyRef,
    inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cva } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { InputComponent } from './input.component';
import { UI_INPUT_GROUP } from '../lib/input-group.token';

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
    imports: [InputComponent, FormsModule],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => NumberInputComponent),
            multi: true,
        },
        {
            provide: UI_INPUT_GROUP,
            useExisting: forwardRef(() => NumberInputComponent),
        },
    ],
    template: `
        <div
            [class]="wrapperClasses()"
            [attr.data-slot]="'number-input'"
            [attr.aria-disabled]="isDisabled() || null"
        >
            <ui-input
                #inputRef
                type="number"
                class="px-3"
                [disabled]="isDisabled()"
                [placeholder]="placeholder()"
                [ngModel]="displayValue()"
                (ngModelChange)="onInputChange($event)"
                (blur)="onBlur()"
                (keydown)="onKeydown($event)"
            />
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

    readonly inputRef = viewChild.required<InputComponent>('inputRef');

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

    private readonly destroyRef = inject(DestroyRef);
    private onChange: (value: number | null) => void = () => { };
    private onTouched: () => void = () => { };

    constructor() {
        effect(() => {
            this._currentValue.set(this.value());
        });
        effect(() => {
            const nativeInput = this.inputRef().inputRef().nativeElement;
            const handler = (e: WheelEvent) => {
                if (globalThis.document.activeElement !== nativeInput) return;
                e.preventDefault();
                if (e.deltaY < 0) this.increment();
                else if (e.deltaY > 0) this.decrement();
            };
            nativeInput.addEventListener('wheel', handler, { passive: false });
            this.destroyRef.onDestroy(() => nativeInput.removeEventListener('wheel', handler));
        });
    }

    onInputChange(raw: string): void {
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
        this._currentValue.set(value);
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
        this.inputRef().focus();
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
