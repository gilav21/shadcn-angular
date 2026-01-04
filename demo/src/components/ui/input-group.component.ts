import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';

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
@Component({
    selector: 'ui-input-group',
    changeDetection: ChangeDetectionStrategy.OnPush,
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

    classes = computed(() => cn(
        'group/input-group relative flex w-full items-center rounded-md border border-input shadow-xs',
        'transition-[color,box-shadow] outline-none',
        'h-9 min-w-0',
        // Focus state
        'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50 has-[input:focus-visible]:ring-[3px]',
        // Disabled state
        this.disabled() && 'opacity-50 cursor-not-allowed',
        this.class()
    ));
}

/**
 * InputGroupInput - The main input within an input group
 */
@Component({
    selector: 'ui-input-group-input',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <input 
      [type]="type()"
      [class]="classes()"
      [attr.data-slot]="'input-group-control'"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
    />
  `,
    host: { class: 'contents' },
})
export class InputGroupInputComponent {
    class = input('');
    type = input('text');
    placeholder = input('');
    disabled = input(false);

    classes = computed(() => cn(
        'flex-1 min-w-0 bg-transparent px-3 py-1 text-base md:text-sm',
        'placeholder:text-muted-foreground',
        'focus:outline-none',
        'disabled:cursor-not-allowed',
        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        this.class()
    ));
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
