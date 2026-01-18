import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  forwardRef,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../lib/utils';
import { UI_INPUT_GROUP } from './input-group.token';

import { cva, type VariantProps } from 'class-variance-authority';

/**
 * InputGroup - Group inputs with addons and buttons
 * 
 * Usage:
 * <ui-input-group>
 *   <ui-input-group-addon>$</ui-input-group-addon>
 *   <ui-input-group-input placeholder="0.00" />
 *   <ui-input-group-addon>USD</ui-input-group-addon>
 * </ui-input-group>
 */



const inputGroupVariants = cva(
  'group/input-group relative flex w-full items-center transition-[color,box-shadow] outline-none h-9 min-w-0 has-[input:focus-visible]:ring-[3px]',
  {
    variants: {
      variant: {
        outline: 'rounded-md border border-input shadow-xs has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50',
        underline: 'rounded-none border-b border-input has-[input:focus-visible]:border-ring px-0 has-[input:focus-visible]:ring-0',
        ghost: 'border-none shadow-none has-[input:focus-visible]:ring-0',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  }
);

export type InputGroupVariant = VariantProps<typeof inputGroupVariants>['variant'];

@Component({
  selector: 'ui-input-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: UI_INPUT_GROUP, useExisting: forwardRef(() => InputGroupComponent) }],
  template: `
    <div 
      [class]="classes()"
      [attr.data-slot]="'input-group'"
      [attr.data-disabled]="disabled() || null"
      role="group"
    >
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class InputGroupComponent {
  class = input('');
  disabled = input(false);
  variant = input<InputGroupVariant>('outline');

  classes = computed(() => cn(
    inputGroupVariants({ variant: this.variant() }),
    this.disabled() && 'opacity-50 cursor-not-allowed',
    this.class()
  ));
}

@Component({
  selector: 'ui-input-group-input',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputGroupInputComponent),
      multi: true,
    },
  ],
  template: `
    <input 
      [type]="type()"
      [class]="classes()"
      [attr.data-slot]="'input-group-control'"
      [placeholder]="placeholder()"
      [disabled]="isDisabled()"
      [ngModel]="value()"
      (ngModelChange)="onValueChange($event)"
      (blur)="onTouched()"
    />
  `,
  host: { class: 'contents' },
})
export class InputGroupInputComponent implements ControlValueAccessor {
  class = input('');
  type = input('text');
  placeholder = input('');
  disabled = input(false);

  value = signal('');
  private formDisabled = signal(false);
  isDisabled = computed(() => this.disabled() || this.formDisabled());

  private onChange: (value: string) => void = () => { };
  onTouched: () => void = () => { };

  classes = computed(() => cn(
    'flex-1 min-w-0 bg-transparent px-3 py-1 text-base md:text-sm',
    'placeholder:text-muted-foreground',
    'focus:outline-none',
    'disabled:cursor-not-allowed',
    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
    this.class()
  ));

  onValueChange(value: string) {
    this.value.set(value);
    this.onChange(value);
  }

  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}

/**
 * InputGroupAddon - Addon elements (icons, text, buttons) within an input group
 */
@Component({
  selector: 'ui-input-group-addon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      [class]="classes()"
      [attr.data-slot]="'input-group-addon'"
      [attr.data-align]="align()"
    >
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class InputGroupAddonComponent {
  class = input('');
  align = input<'inline-start' | 'inline-end'>('inline-start');

  classes = computed(() => cn(
    'text-muted-foreground flex h-auto items-center justify-center gap-2 py-1.5 text-sm font-medium select-none',
    '[&>svg:not([class*="size-"])]:size-4',
    this.align() === 'inline-start' ? 'pl-3 pr-1' : 'pl-1 pr-3',
    this.class()
  ));
}

/**
 * InputGroupText - Static text within an addon
 */
@Component({
  selector: 'ui-input-group-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span 
      [class]="classes()"
      [attr.data-slot]="'input-group-text'"
    >
      <ng-content />
    </span>
  `,
  host: { class: 'contents' },
})
export class InputGroupTextComponent {
  class = input('');

  classes = computed(() => cn(
    'text-muted-foreground text-sm',
    this.class()
  ));
}
