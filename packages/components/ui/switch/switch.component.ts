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
import { SkeletonComponent } from '../skeleton';

@Component({
    selector: 'ui-switch',
    imports: [SkeletonComponent],
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

    /**
     * Disables the switch. OR-ed with the state pushed by
     * {@link setDisabledState}, so a reactive-forms `disable()` also wins even
     * when this input stays `false`.
     */
    disabled = input(false);
    /** Extra classes merged onto the track button (see {@link trackClasses}); the thumb is not affected. */
    class = input('');
    /** Renders placeholder blocks instead of the control; the label slot gets its own placeholder when {@link label} is set. */
    readonly skeleton = input(false);
    /** `id` for the track button. Ignored when {@link label} is set — the auto-generated {@link computedId} is used so the label's `for` can bind. */
    elementId = input<string | undefined>(undefined);
    /** `aria-label` for the track button. Only applied when {@link label} is unset, since the rendered label already names the control. */
    ariaLabel = input<string | undefined>(undefined);
    /** `aria-labelledby` for the track button. Only applied when {@link label} is unset. */
    ariaLabelledby = input<string | undefined>(undefined);
    /** Two-way on/off state, mirrored to `aria-checked` and driving the thumb position. Also written by {@link writeValue}. */
    checked = model(false);

    /** Simple mode: renders an associated `<label>` next to the track, wired to {@link computedId}. */
    label = input<string | undefined>(undefined);

    // Auto-generate ID when label is used
    private readonly _generatedId = `switch-${++SwitchComponent.idCounter}`;
    readonly computedId = computed(() => this._generatedId);

    private readonly _disabled = signal(false);
    readonly isDisabled = computed(() => this.disabled() || this._disabled());

    private onChange: (value: boolean) => void = () => { };
    private onTouched: () => void = () => { };

    readonly trackClasses = computed(() =>
        cn(
            'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
            this.checked() ? 'bg-primary' : 'bg-input',
            this.class()
        )
    );

    readonly thumbClasses = computed(() =>
        cn(
            'pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform',
            this.checked() ? 'ltr:translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
        )
    );

    /** Flips {@link checked} and notifies the form (change + touched). No-op while disabled; this is also the only place touched is raised. */
    toggle(): void {
        if (this.isDisabled()) return;
        const newValue = !this.checked();
        this.checked.set(newValue);
        this.onChange(newValue);
        this.onTouched();
    }

    /** Pushes a form value into {@link checked}, coercing `null`/`undefined` to `false`. Does not emit back to the form. */
    writeValue(value: boolean): void {
        this.checked.set(value ?? false);
    }

    /** Stores the form's change callback, invoked by {@link toggle}. */
    registerOnChange(fn: (value: boolean) => void): void {
        this.onChange = fn;
    }

    /** Stores the form's touched callback; the switch raises it on toggle rather than on blur. */
    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    /** Records the form's disabled state separately from the {@link disabled} input; either one disables the control. */
    setDisabledState(isDisabled: boolean): void {
        this._disabled.set(isDisabled);
    }

    /** String form of the current {@link checked} value (`"true"`/`"false"`), handy in templates and test assertions. */
    toString(): string {
        return String(this.checked());
    }
}

