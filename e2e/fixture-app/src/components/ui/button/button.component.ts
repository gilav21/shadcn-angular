import {
    Component,
    ChangeDetectionStrategy,
    ElementRef,
    inject,
    input,
    output,
    computed,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/components/lib/utils';
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
                secondary: 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80',
                ghost: 'hover:bg-muted hover:text-foreground',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                default: 'py-2',
                sm: 'rounded-md text-xs',
                lg: 'rounded-md',
                icon: '',
                'icon-sm': '',
                'icon-lg': '',
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
        // The host is a `display: contents` generic element: an aria-label left on
        // it names nothing (axe `aria-prohibited-attr`) and, worse, never reaches
        // the inner <button>, leaving it nameless (axe `button-name`). Consume it
        // via the `aria-label` aliased input below and strip it from the host.
        '[attr.aria-label]': 'null',
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
    /** Visual style. `link` renders as inline text; `destructive` is tinted, not solid. */
    readonly variant = input<ButtonVariant>('default');
    /**
     * Size preset. The three `icon*` sizes drop the horizontal padding for a
     * square button holding a single glyph.
     */
    readonly size = input<ButtonSize>('default');
    /** Disables the inner `<button>`. Also forced while {@link loading} is true. */
    readonly disabled = input(false);
    /** Native `type` of the inner `<button>`. Defaults to `'button'` so it never submits a form by accident. */
    readonly type = input<'button' | 'submit' | 'reset'>('button');
    /** Extra classes merged onto the inner `<button>` (not the host). */
    readonly class = input('');
    /** Accessible name, camelCase form: `[ariaLabel]="'Copy'"`. */
    ariaLabel = input<string | undefined>(undefined);
    /**
     * An accessible name written the native way — `aria-label="Copy"` on
     * `<ui-button>`. Read off the host here and moved to the inner `<button>`,
     * instead of being stranded on the `display: contents` host where it named
     * nothing (the host binding above strips it).
     */
    private readonly hostAriaLabel =
        inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.getAttribute('aria-label') ?? undefined;
    /** The name actually applied to the inner `<button>`, from either spelling. */
    readonly resolvedAriaLabel = computed(() => this.ariaLabel() ?? this.hostAriaLabel);
    /**
     * Convenience text label. When set it replaces projected content — pass
     * either this or `<ng-content>`, not both.
     */
    readonly label = input<string>('');
    /** Enable the material-style ripple on press. */
    readonly ripple = input(false);
    /** Ripple colour, any CSS colour. Defaults to a translucent tint of the current text colour. */
    readonly rippleColor = input('color-mix(in srgb, currentColor 35%, transparent)');
    /**
     * Show a centred spinner over the button's content and disable it. The label
     * stays in the DOM, so the button keeps its width and the layout doesn't jump.
     */
    readonly loading = input(false);
    /** Replace the button entirely with a skeleton placeholder while content loads. */
    readonly skeleton = input(false);

    /** Emits the native click. Never fires while disabled, loading, or in skeleton mode. */
    readonly clicked = output<MouseEvent>();

    readonly classes = computed(() =>
        cn(buttonVariants({ variant: this.variant(), size: this.size() }), this.loading() && 'relative', this.class())
    );
}

export { buttonVariants };
