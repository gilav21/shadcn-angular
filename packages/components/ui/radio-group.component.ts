import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    model,
    forwardRef,
    inject,
    InjectionToken,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../lib/utils';

export const RADIO_GROUP = new InjectionToken<RadioGroupComponent>('RADIO_GROUP');

@Component({
    selector: 'ui-radio-group',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => RadioGroupComponent),
            multi: true,
        },
        {
            provide: RADIO_GROUP,
            useExisting: forwardRef(() => RadioGroupComponent),
        },
    ],
    template: `
    <div
      role="radiogroup"
      [attr.aria-orientation]="orientation()"
      [class]="classes()"
      [attr.data-slot]="'radio-group'"
    >
      <ng-content />
    </div>
  `,
    host: {
        '[class]': '"contents"',
    },
})
export class RadioGroupComponent implements ControlValueAccessor {
    orientation = input<'horizontal' | 'vertical'>('vertical');
    disabled = input(false);
    class = input('');

    value = model<string | null>(null);

    private onChange: (value: string) => void = () => { };
    private onTouched: () => void = () => { };

    classes = computed(() =>
        cn(
            'grid gap-2',
            this.orientation() === 'horizontal' ? 'grid-flow-col' : 'grid-flow-row',
            this.class()
        )
    );

    selectValue(val: string) {
        if (this.disabled()) return;
        this.value.set(val);
        this.onChange(val);
        this.onTouched();
    }

    writeValue(value: string): void {
        this.value.set(value);
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void { }
}

@Component({
    selector: 'ui-radio-group-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      type="button"
      role="radio"
      [attr.aria-checked]="isSelected()"
      [attr.data-state]="isSelected() ? 'checked' : 'unchecked'"
      [class]="classes()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      [attr.data-slot]="'radio-group-item'"
      (click)="select()"
    >
      @if (isSelected()) {
        <span class="flex items-center justify-center">
          <span class="h-2.5 w-2.5 rounded-full bg-current"></span>
        </span>
      }
    </button>
  `,
    host: {
        '[class]': '"contents"',
    },
})
export class RadioGroupItemComponent {
    value = input.required<string>();
    disabled = input(false);
    class = input('');
    ariaLabel = input<string | undefined>(undefined);

    private group = inject(RADIO_GROUP, { optional: true });

    isSelected = computed(() => this.group?.value() === this.value());

    classes = computed(() =>
        cn(
            'aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center',
            this.isSelected() ? 'border-primary' : 'bg-background',
            this.class()
        )
    );

    select() {
        if (this.disabled() || !this.group) return;
        this.group.selectValue(this.value());
    }
}
