import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
    'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive rounded-lg border border-transparent text-sm font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none select-none cursor-pointer',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground hover:bg-primary/90',
                destructive: 'bg-destructive/10 hover:bg-destructive/20 text-destructive focus-visible:ring-destructive/20',
                outline: 'border-input bg-background hover:bg-muted hover:text-foreground',
                secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                ghost: 'hover:bg-muted hover:text-foreground',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-9 px-4 py-2',
                sm: 'h-8 rounded-md px-3 text-xs',
                lg: 'h-10 rounded-md px-8',
                icon: 'h-9 w-9',
                'icon-sm': 'h-8 w-8',
                'icon-lg': 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

@Component({
    selector: 'ui-button',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      [class]="classes()"
      [disabled]="disabled()"
      [type]="type()"
      [attr.data-slot]="'button'"
    >
      <ng-content />
    </button>
  `,
    host: {
        '[class]': '"contents"',
    },
})
export class ButtonComponent {
    variant = input<ButtonVariant>('default');
    size = input<ButtonSize>('default');
    disabled = input(false);
    type = input<'button' | 'submit' | 'reset'>('button');
    class = input('');

    clicked = output<MouseEvent>();

    classes = computed(() =>
        cn(buttonVariants({ variant: this.variant(), size: this.size() }), this.class())
    );
}

export { buttonVariants };
