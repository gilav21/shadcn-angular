import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { UiRippleDirective } from '../ripple.directive';
import { SpinnerComponent } from '../spinner';
import { SkeletonComponent } from '../skeleton';

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
    imports: [UiRippleDirective, SpinnerComponent, SkeletonComponent],
    templateUrl: './button.component.html',
    styleUrl: './button.component.css',
    host: {
        '[class]': '"contents"',
        '[attr.data-size]': 'size()',
    },
})
/**
 * Primary button primitive. Supports the variant / size matrix declared
 * above and forwards the click event via the `(clicked)` output.
 *
 * `host: { '[class]': '"contents"' }` keeps the wrapping `<ui-button>`
 * element transparent in the layout — the inner `<button>` is the real
 * focus / hit target.
 */
export class ButtonComponent {
    variant = input<ButtonVariant>('default');
    size = input<ButtonSize>('default');
    disabled = input(false);
    type = input<'button' | 'submit' | 'reset'>('button');
    class = input('');
    ariaLabel = input<string | undefined>(undefined);
    label = input<string>('');
    ripple = input(false);
    rippleColor = input('color-mix(in srgb, currentColor 35%, transparent)');
    readonly loading = input(false);
    readonly skeleton = input(false);

    clicked = output<MouseEvent>();

    readonly classes = computed(() =>
        cn(buttonVariants({ variant: this.variant(), size: this.size() }), this.loading() && 'relative', this.class())
    );
}

export { buttonVariants };
