import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    model,
    forwardRef,
    signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-switch',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrl: './switch.component.css',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => SwitchComponent),
            multi: true,
        },
    ],
    templateUrl: './switch.component.html',
    host: {
        '[class]': '"contents"',
    },
})
export class SwitchComponent implements ControlValueAccessor {
    private static idCounter = 0;

    disabled = input(false);
    class = input('');
    elementId = input<string | undefined>(undefined);
    ariaLabel = input<string | undefined>(undefined);
    ariaLabelledby = input<string | undefined>(undefined);
    checked = model(false);

    // Simple mode: inline label
    label = input<string | undefined>(undefined);

    // Auto-generate ID when label is used
    private readonly _generatedId = `switch-${++SwitchComponent.idCounter}`;
    computedId = computed(() => this._generatedId);

    private readonly _disabled = signal(false);
    readonly isDisabled = computed(() => this.disabled() || this._disabled());

    private onChange: (value: boolean) => void = () => { };
    private onTouched: () => void = () => { };

    trackClasses = computed(() =>
        cn(
            'peer inline-flex h-[calc(1.25rem*var(--_d))] w-[calc(2.25rem*var(--_d))] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
            this.checked() ? 'bg-primary' : 'bg-input',
            this.class()
        )
    );

    thumbClasses = computed(() =>
        cn(
            'pointer-events-none block h-[calc(1rem*var(--_d))] w-[calc(1rem*var(--_d))] rounded-full bg-background shadow-lg ring-0 transition-transform',
            this.checked() ? 'ltr:translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
        )
    );

    toggle() {
        if (this.isDisabled()) return;
        const newValue = !this.checked();
        this.checked.set(newValue);
        this.onChange(newValue);
        this.onTouched();
    }

    writeValue(value: boolean): void {
        this.checked.set(value ?? false);
    }

    registerOnChange(fn: (value: boolean) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this._disabled.set(isDisabled);
    }

    toString(): string {
        return String(this.checked());
    }
}

