import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { AlertTitleComponent } from './sub/alert-title.component';
import { AlertDescriptionComponent } from './sub/alert-description.component';

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
        '[attr.role]': '"alert"',
        '[attr.data-slot]': '"alert"',
    },
})
export class AlertComponent {
    variant = input<AlertVariant>('default');
    class = input('');
    title = input('');
    description = input('');

    classes = computed(() =>
        cn(alertVariants({ variant: this.variant() }), this.class())
    );
}


export { alertVariants, AlertTitleComponent, AlertDescriptionComponent };
