import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../lib/utils';

/**
 * NativeSelect - Styled native select element
 * 
 * Usage:
 * <ui-native-select>
 *   <option value="">Select an option</option>
 *   <option value="1">Option 1</option>
 *   <option value="2">Option 2</option>
 * </ui-native-select>
 */
@Component({
    selector: 'ui-native-select',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => NativeSelectComponent),
            multi: true,
        },
    ],
    template: `
    <div 
      class="group/native-select relative w-fit"
      [class.opacity-50]="disabled()"
      [attr.data-slot]="'native-select-wrapper'"
    >
      <select
        [class]="classes()"
        [attr.data-slot]="'native-select'"
        [attr.data-size]="size()"
        [disabled]="disabled()"
        [attr.aria-invalid]="invalid() || null"
        (change)="onSelectChange($event)"
        (blur)="onTouched()"
      >
        <ng-content />
      </select>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        class="text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 opacity-50 select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      >
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </div>
  `,
    host: { class: 'contents' },
})
export class NativeSelectComponent implements ControlValueAccessor {
    class = input('');
    size = input<'sm' | 'default'>('default');
    disabled = input(false);
    invalid = input(false);

    // ControlValueAccessor
    onChange: (value: string) => void = () => { };
    onTouched: () => void = () => { };

    classes = computed(() => cn(
        'border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
        'h-9 w-full min-w-0 appearance-none rounded-md border bg-transparent px-3 py-2 pr-9 text-sm shadow-xs',
        'transition-[color,box-shadow] outline-none',
        'disabled:pointer-events-none disabled:cursor-not-allowed',
        this.size() === 'sm' && 'h-8 py-1',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        this.invalid() && 'ring-destructive/20 border-destructive',
        this.class()
    ));

    onSelectChange(event: Event) {
        const value = (event.target as HTMLSelectElement).value;
        this.onChange(value);
    }

    writeValue(value: string): void {
        // Value is set via native select binding
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        // Handled by input
    }
}
