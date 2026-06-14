import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  forwardRef,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';

import { cva, type VariantProps } from 'class-variance-authority';

/**
 * InputGroup - Group inputs with addons and buttons
 *
 * Usage:
 * <ui-input-group>
 *   <ui-input-group-addon>$</ui-input-group-addon>
 *   <ui-input-group-input placeholder="0.00" /> <!-- Legacy/Simple -->
 *   <!-- OR -->
 *   <ui-input placeholder="0.00" /> <!-- Automatic ghost variant -->
 *   <ui-input-group-addon>USD</ui-input-group-addon>
 * </ui-input-group>
 */



const inputGroupVariants = cva(
  'group/input-group relative flex w-full items-center transition-[color,box-shadow] outline-none min-w-0 has-[input:focus-visible]:ring-[3px]',
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
  templateUrl: './input-group.component.html',
  styleUrl: './input-group.component.css',
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
