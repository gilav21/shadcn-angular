import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const alertVariants = cva(
    'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7',
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
    template: `<ng-content />`,
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

    classes = computed(() =>
        cn(alertVariants({ variant: this.variant() }), this.class())
    );
}

@Component({
    selector: 'ui-alert-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"alert-title"',
    },
})
export class AlertTitleComponent {
    class = input('');

    classes = computed(() =>
        cn('mb-1 font-medium leading-none tracking-tight', this.class())
    );
}

@Component({
    selector: 'ui-alert-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"alert-description"',
    },
})
export class AlertDescriptionComponent {
    class = input('');

    classes = computed(() => cn('text-sm [&_p]:leading-relaxed', this.class()));
}

export { alertVariants };
