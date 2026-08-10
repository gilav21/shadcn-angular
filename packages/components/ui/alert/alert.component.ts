import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
export { AlertTitleComponent } from './sub/alert-title.component';
export { AlertDescriptionComponent } from './sub/alert-description.component';

const alertVariants = cva(
    'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:ps-7',
    {
        variants: {
            variant: {
                default: 'bg-background text-foreground',
                destructive:
                    'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

export type AlertVariant = VariantProps<typeof alertVariants>['variant'];

@Component({
    selector: 'ui-alert',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './alert.component.html',
    host: {
        class: 'block',
        '[class]': 'classes()',
        '[attr.role]': 'role()',
        '[attr.aria-live]': 'ariaLive()',
        '[attr.data-slot]': '"alert"',
    },
})
export class AlertComponent {
    /**
     * Severity treatment. Also drives the announcement semantics: `'default'`
     * renders as `role="status"` / `aria-live="polite"`, `'destructive'` as
     * `role="alert"` / `aria-live="assertive"`, which interrupts a screen reader
     * — so reserve it for genuine errors.
     */
    variant = input<AlertVariant>('default');
    /** Extra classes merged onto the host. The variants set colour and layout only; note the built-in `[&>svg]` rules already absolutely position a leading icon and indent the text past it. */
    class = input('');
    /**
     * Simple-mode heading. Supplying it switches the alert to the generated
     * layout — title, optional {@link description}, then any projected content —
     * instead of pure projection. Leave it empty to compose
     * `ui-alert-title` / `ui-alert-description` yourself.
     */
    title = input('');
    /** Simple-mode body text under the title. Only rendered when {@link title} is also set; on its own it is ignored. */
    description = input('');

    classes = computed(() =>
        cn(alertVariants({ variant: this.variant() }), this.class())
    );

    role = computed(() => (this.variant() === 'destructive' ? 'alert' : 'status'));
    ariaLive = computed(() =>
        this.variant() === 'destructive' ? 'assertive' : 'polite'
    );
}


export { alertVariants };
